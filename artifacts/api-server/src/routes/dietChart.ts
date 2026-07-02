import { Router } from "express";
import { ai } from "@workspace/integrations-gemini-ai";
import { db, dietChartTable, foodLogsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router = Router();

const DIET_CHART_SYSTEM_PROMPT = `You are a nutritionist diet chart parser. The user will send you a PDF diet chart created by a nutritionist.

Extract the DAILY nutritional targets and return a JSON object with ONLY these fields (no other fields):
{
  "caloriesKcal": number,
  "proteinG": number,
  "carbsG": number,
  "fatG": number,
  "notes": string or null
}

Rules:
- Look for daily totals OR sum up per-meal targets (breakfast + lunch + dinner + snack)
- If values are in ranges (e.g. 120-140g), take the midpoint
- If calories are missing but macros are present, compute: (proteinG*4) + (carbsG*4) + (fatG*9)
- The chart may use Indian units or abbreviations — gm/gms = grams, Cal/kcal = calories
- Do NOT include any other text, keys, or explanation — return ONLY the JSON object
- All numeric fields MUST be actual numbers, never null or missing`;

const DIET_CHART_FALLBACK_PROMPT = `Read every line of the attached PDF. Look for any numbers next to words like: protein, carbohydrate, carbs, fat, calories, energy, kcal. Even if the chart does not say "daily total", add up all the numbers you find for each macro across all meals.

Return ONLY this JSON (no other text):
{
  "caloriesKcal": number,
  "proteinG": number,
  "carbsG": number,
  "fatG": number,
  "notes": null
}`;

const MEAL_SUGGESTIONS_SYSTEM_PROMPT = `You are a nutritionist specialising in homemade Indian cooking. Given a user's remaining macro budget for the day, suggest appropriate homemade Indian meals.

Return a JSON array of meal suggestions with this exact shape:
[
  {
    "mealType": "breakfast" | "lunch" | "dinner" | "snack",
    "name": "Meal name",
    "description": "Short 1-sentence description of what it contains",
    "calories": number,
    "proteinG": number,
    "carbsG": number,
    "fatG": number
  }
]

Rules:
- Suggest 2-3 meals per meal type that still has remaining budget
- Only suggest homemade Indian meals (no restaurant foods, no Western dishes)
- Each suggestion must fit within the remaining macro budget for that meal slot (use roughly 1/N of total remaining, where N is how many meal slots remain)
- Keep meals practical and common: dal, sabzi, roti, rice, idli, dosa, poha, upma, khichdi, curd, etc.
- Always return valid JSON array only, no markdown, no explanation`;

router.get("/diet-chart", async (req, res) => {
  try {
    const rows = await db.select().from(dietChartTable).orderBy(desc(dietChartTable.uploadedAt)).limit(1);
    if (rows.length === 0) {
      res.json(null);
      return;
    }
    const chart = rows[0];
    res.json({
      id: chart.id,
      uploadedAt: chart.uploadedAt,
      caloriesKcal: chart.caloriesKcal,
      proteinG: chart.proteinG,
      carbsG: chart.carbsG,
      fatG: chart.fatG,
      notes: chart.notes,
    });
  } catch (err) {
    req.log.error({ err }, "diet-chart: failed to fetch chart");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/diet-chart/upload", async (req, res) => {
  const { pdfDataUrl } = req.body as { pdfDataUrl?: string };

  if (!pdfDataUrl || typeof pdfDataUrl !== "string") {
    res.status(400).json({ error: "pdfDataUrl is required" });
    return;
  }

  const base64Match = pdfDataUrl.match(/^data:(application\/pdf);base64,(.+)$/);
  if (!base64Match) {
    res.status(400).json({ error: "Invalid PDF data URL — must be a base64-encoded application/pdf" });
    return;
  }
  const base64Data = base64Match[2];

  try {
    type MacroParsed = { caloriesKcal: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null; notes?: string | null };

    async function callGemini(systemPrompt: string, userText: string): Promise<MacroParsed | null> {
      const resp = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "application/pdf", data: base64Data } },
              { text: userText },
            ],
          },
        ],
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
      const raw = resp.text ?? "";
      const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
      try {
        return JSON.parse(jsonStr) as MacroParsed;
      } catch {
        req.log.warn({ raw: raw.slice(0, 500) }, "diet-chart: Gemini JSON parse failed");
        return null;
      }
    }

    const hasMacros = (p: MacroParsed | null): p is MacroParsed =>
      p !== null &&
      typeof p.caloriesKcal === "number" && p.caloriesKcal > 0 &&
      typeof p.proteinG === "number" && p.proteinG > 0;

    let parsed = await callGemini(DIET_CHART_SYSTEM_PROMPT, "Extract the daily macro targets from this nutritionist diet chart.");

    if (!hasMacros(parsed)) {
      req.log.warn("diet-chart: first pass returned nulls — trying fallback prompt");
      parsed = await callGemini(DIET_CHART_FALLBACK_PROMPT, "Find all nutrition numbers in this document and return them as JSON.");
    }

    if (!hasMacros(parsed)) {
      req.log.warn("diet-chart: both passes failed to extract macros");
      res.status(422).json({ error: "Could not extract macro targets from the PDF. Make sure it is a nutritionist diet chart with calorie and macro numbers." });
      return;
    }

    const proteinG = Number(parsed.proteinG);
    const carbsG = Number(parsed.carbsG) || 0;
    const fatG = Number(parsed.fatG) || 0;
    const caloriesKcal = Number(parsed.caloriesKcal) > 0
      ? Number(parsed.caloriesKcal)
      : Math.round(proteinG * 4 + carbsG * 4 + fatG * 9);

    await db.delete(dietChartTable);

    const [inserted] = await db.insert(dietChartTable).values({
      caloriesKcal,
      proteinG,
      carbsG,
      fatG,
      rawText: "",
      notes: parsed.notes ?? null,
    }).returning();

    res.json({
      id: inserted.id,
      uploadedAt: inserted.uploadedAt,
      caloriesKcal: inserted.caloriesKcal,
      proteinG: inserted.proteinG,
      carbsG: inserted.carbsG,
      fatG: inserted.fatG,
      notes: inserted.notes,
    });
  } catch (err) {
    req.log.error({ err }, "diet-chart: Gemini call failed");
    res.status(500).json({ error: "Failed to process PDF — please try again." });
  }
});

router.get("/diet-chart/suggestions", async (req, res) => {
  const dateParam = req.query.date;
  const date = typeof dateParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : new Date().toISOString().split("T")[0];

  try {
    const [chartRows, foodLogs] = await Promise.all([
      db.select().from(dietChartTable).orderBy(desc(dietChartTable.uploadedAt)).limit(1),
      db.select().from(foodLogsTable).where(eq(foodLogsTable.date, date)),
    ]);

    if (chartRows.length === 0) {
      res.json([]);
      return;
    }

    const chart = chartRows[0];

    const consumed = foodLogs.reduce(
      (acc, f) => ({
        calories: acc.calories + (f.calories ?? 0),
        protein: acc.protein + (f.proteinG ?? 0),
        carbs: acc.carbs + (f.carbsG ?? 0),
        fat: acc.fat + (f.fatG ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    const remaining = {
      calories: Math.max(0, chart.caloriesKcal - consumed.calories),
      proteinG: Math.max(0, chart.proteinG - consumed.protein),
      carbsG: Math.max(0, chart.carbsG - consumed.carbs),
      fatG: Math.max(0, chart.fatG - consumed.fat),
    };

    if (remaining.calories < 50) {
      res.json([]);
      return;
    }

    const loggedMealTypes = new Set(foodLogs.map((f) => f.mealType));
    const allMealTypes = ["breakfast", "lunch", "dinner", "snack"];
    const remainingMeals = allMealTypes.filter((m) => !loggedMealTypes.has(m));

    if (remainingMeals.length === 0) {
      res.json([]);
      return;
    }

    const userPrompt = `The user still needs to eat: ${remainingMeals.join(", ")}.
Their remaining macro budget for the day:
- Calories: ${Math.round(remaining.calories)} kcal
- Protein: ${Math.round(remaining.proteinG)}g
- Carbs: ${Math.round(remaining.carbsG)}g  
- Fat: ${Math.round(remaining.fatG)}g

Please suggest 2-3 homemade Indian meals for each of the remaining meal slots: ${remainingMeals.join(", ")}.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: MEAL_SUGGESTIONS_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const raw = response.text ?? "";
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

    let suggestions: unknown[];
    try {
      suggestions = JSON.parse(jsonStr);
      if (!Array.isArray(suggestions)) suggestions = [];
    } catch {
      req.log.warn({ raw }, "diet-chart: failed to parse suggestions JSON");
      suggestions = [];
    }

    res.json(suggestions);
  } catch (err) {
    req.log.error({ err }, "diet-chart: suggestions call failed");
    res.status(500).json({ error: "Failed to generate suggestions." });
  }
});

export default router;
