import { Router } from "express";
import { ai } from "@workspace/integrations-gemini-ai";

const router = Router();

const SYSTEM_PROMPT = `You are a medical prescription and medicine label parser specialising in handwritten doctor prescriptions.
The user will send you an image of one of the following:
1. A handwritten doctor's prescription (cursive or printed by hand)
2. A printed prescription document or medicine label
3. A physical tablet or pill

Handwritten prescriptions often use medical shorthand — interpret these correctly:
- "OD" or "od" → daily (once daily)
- "BD" or "bd" → twice_daily (bis die / twice a day)
- "TDS" or "tds" or "TD" → three_times_daily (ter die sumendum)
- "QID" or "qid" → three_times_daily (approximate; four times daily mapped to three_times_daily)
- "SOS" or "sos" or "PRN" or "prn" → as_needed
- "OW" or "ow" → weekly
- "AC" → before_food (ante cibum)
- "PC" → after_food (post cibum)
- "CC" or "with meals" → after_food
- "HS" or "hs" → any (bedtime dose)
- Dosage shorthands like "tab", "cap", "syr", "inj", "gtts" map to tablet, capsule, syrup, injection, drops
- Drug names may be abbreviated or written in generic/brand form — do your best to identify the full medicine name

Extract as much schedule information as possible and return a JSON object with these exact fields:
{
  "name": "medicine name (string, required)",
  "dose": "dose with unit e.g. '500mg', '10mg', '2000IU' (string, required)",
  "form": "one of: tablet, capsule, syrup, injection, drops, patch, other (string, required)",
  "frequency": "one of: daily, twice_daily, three_times_daily, weekly, as_needed (string, required)",
  "timesOfDay": ["HH:MM array of 24h times matching the frequency, e.g. ['08:00'] for daily, ['08:00','20:00'] for twice_daily"],
  "foodInstruction": "one of: before_food, after_food, with_water, any (string, required)",
  "pillCount": number or null (estimated quantity on label if visible, else null),
  "prescriptionExpiry": "YYYY-MM-DD string if a date is visible on the prescription, else null",
  "confidence": "high, medium, or low depending on how legible the handwriting is and how complete the information is",
  "scanType": "prescription, label, or pill depending on what was detected"
}

Rules:
- For timesOfDay: daily → ["08:00"], twice_daily → ["08:00","20:00"], three_times_daily → ["08:00","13:00","20:00"], weekly → ["08:00"], as_needed → ["08:00"]
- Override timesOfDay with explicit times if the prescription says e.g. "morning and night", "8am and 9pm", etc.
- If the image shows a tablet/pill, try to identify the imprint markings, color, and shape to determine the medicine
- If handwriting is unclear, make your best reasonable guess and set confidence to "low" rather than leaving fields empty
- Always return valid JSON only, no markdown, no explanation`;

router.post("/medicines/parse-scan", async (req, res) => {
  const { imageDataUrl, mode } = req.body as { imageDataUrl?: string; mode?: string };

  if (!imageDataUrl || typeof imageDataUrl !== "string") {
    res.status(400).json({ error: "imageDataUrl is required" });
    return;
  }

  // Strip the data URL prefix to get base64
  const base64Match = imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!base64Match) {
    res.status(400).json({ error: "Invalid image data URL format" });
    return;
  }
  const mimeType = `image/${base64Match[1] === "jpg" ? "jpeg" : base64Match[1]}`;
  const base64Data = base64Match[2];

  const userPrompt = mode === "pill"
    ? "This image shows a tablet or pill. Please identify it and extract its medicine schedule information."
    : "This image shows a prescription document or medicine label. Please extract the medicine schedule information.";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: userPrompt },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
      },
    });

    const raw = response.text ?? "";

    // Strip stray markdown fences just in case
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      req.log.warn({ raw }, "parse-scan: failed to parse Gemini JSON output");
      res.status(422).json({ error: "Could not parse scan — try again or enter details manually." });
      return;
    }

    res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "parse-scan: Gemini call failed");
    res.status(500).json({ error: "Scan failed — try again or enter details manually." });
  }
});

export default router;
