import { Router } from "express";
import { db, foodLogsTable, userProfileTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function buildRecipesPrompt(
  allergens: string[],
  caloriesRemaining: number,
  proteinRemaining: number,
  carbsRemaining: number,
  fatRemaining: number
): string {
  const allergenText = allergens.length > 0 ? allergens.join(", ") : "none";
  return `Return a JSON array of 3 diverse healthy recipe suggestions. Each recipe must be a JSON object with these exact fields:
{
  "title": string,
  "description": string (1-2 sentences about the dish),
  "ingredients": string[] (each item as "quantity unit ingredient", e.g. "200g chicken breast"),
  "steps": string[] (numbered cooking steps, 4-6 steps),
  "calories": number,
  "proteinG": number,
  "carbsG": number,
  "fatG": number,
  "allergenFlags": string[] (list of allergens present in this recipe),
  "cookTimeMinutes": number,
  "servings": number
}

Constraints:
- Exclude recipes containing these allergens: ${allergenText}
- Target remaining macros for today: ~${Math.round(caloriesRemaining)} calories, ~${Math.round(proteinRemaining)}g protein, ~${Math.round(carbsRemaining)}g carbs, ~${Math.round(fatRemaining)}g fat
- Make recipes varied: one protein-heavy, one vegetable-rich, one balanced/comfort meal
- Keep allergenFlags empty array [] if the recipe contains none of the user's allergens
- Respond with ONLY the JSON array, no markdown, no explanation`;
}

router.get("/recipes/suggestions", async (req, res) => {
  try {
    const date = typeof req.query.date === "string" ? req.query.date : new Date().toISOString().split("T")[0];

    const [profile] = await db.select().from(userProfileTable);
    const foodLogs = await db
      .select()
      .from(foodLogsTable)
      .where(eq(foodLogsTable.date, date));

    const calorieGoal = profile?.calorieGoal ?? 2000;
    const proteinGoal = profile?.proteinGoalG ?? 120;
    const carbsGoal = profile?.carbsGoalG ?? 250;
    const fatGoal = profile?.fatGoalG ?? 65;
    const allergens = profile?.allergens ?? [];

    const consumed = foodLogs.reduce(
      (acc, f) => ({
        calories: acc.calories + (f.calories ?? 0),
        protein: acc.protein + (f.proteinG ?? 0),
        carbs: acc.carbs + (f.carbsG ?? 0),
        fat: acc.fat + (f.fatG ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    const caloriesRemaining = Math.max(0, calorieGoal - consumed.calories);
    const proteinRemaining = Math.max(0, proteinGoal - consumed.protein);
    const carbsRemaining = Math.max(0, carbsGoal - consumed.carbs);
    const fatRemaining = Math.max(0, fatGoal - consumed.fat);

    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      res.json(getFallbackRecipes(allergens));
      return;
    }

    const prompt = buildRecipesPrompt(
      allergens,
      caloriesRemaining,
      proteinRemaining,
      carbsRemaining,
      fatRemaining
    );

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      res.json(getFallbackRecipes(allergens));
      return;
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const content = data.choices[0]?.message?.content ?? "[]";

    try {
      const recipes = JSON.parse(content);
      res.json(Array.isArray(recipes) ? recipes : getFallbackRecipes(allergens));
    } catch {
      res.json(getFallbackRecipes(allergens));
    }
  } catch (err) {
    req.log.error({ err }, "Failed to get recipe suggestions");
    res.status(500).json({ error: "Internal server error" });
  }
});

function getFallbackRecipes(allergens: string[]) {
  return [
    {
      title: "Grilled Chicken with Quinoa",
      description: "A high-protein, balanced meal with lean chicken and nutrient-rich quinoa.",
      ingredients: [
        "150g chicken breast",
        "80g quinoa",
        "1 cup broccoli florets",
        "1 tbsp olive oil",
        "Salt, pepper, garlic powder to taste",
      ],
      steps: [
        "Season chicken breast with salt, pepper, and garlic powder.",
        "Grill chicken for 6-7 minutes per side until cooked through.",
        "Cook quinoa in 160ml water for 12 minutes.",
        "Steam broccoli for 5 minutes until tender.",
        "Slice chicken and serve over quinoa with broccoli.",
      ],
      calories: 420,
      proteinG: 48,
      carbsG: 32,
      fatG: 9,
      allergenFlags: [],
      cookTimeMinutes: 25,
      servings: 1,
    },
    {
      title: "Lentil Vegetable Soup",
      description: "A hearty, fiber-rich soup packed with vegetables and plant-based protein.",
      ingredients: [
        "200g red lentils",
        "1 large carrot diced",
        "2 stalks celery chopped",
        "1 can diced tomatoes",
        "1 tsp cumin",
        "1 tsp turmeric",
        "4 cups vegetable broth",
      ],
      steps: [
        "Rinse lentils and set aside.",
        "Saute carrot and celery in a pot for 5 minutes.",
        "Add spices and cook for 1 minute.",
        "Add lentils, tomatoes, and broth. Bring to boil.",
        "Simmer for 20 minutes until lentils are soft.",
        "Season with salt and pepper to taste.",
      ],
      calories: 340,
      proteinG: 22,
      carbsG: 58,
      fatG: 3,
      allergenFlags: [],
      cookTimeMinutes: 30,
      servings: 2,
    },
    {
      title: "Greek Yogurt Parfait",
      description: "A quick, high-protein snack with probiotics and natural sweetness.",
      ingredients: [
        "200g plain Greek yogurt",
        "40g rolled oats",
        "1 tbsp honey",
        "100g mixed berries",
        "1 tbsp chia seeds",
      ],
      steps: [
        "Layer Greek yogurt in a bowl or glass.",
        "Add rolled oats on top.",
        "Layer mixed berries over the oats.",
        "Drizzle honey and sprinkle chia seeds.",
        "Serve immediately or refrigerate overnight.",
      ],
      calories: 380,
      proteinG: 26,
      carbsG: 52,
      fatG: 7,
      allergenFlags: allergens.includes("dairy") ? ["dairy"] : [],
      cookTimeMinutes: 5,
      servings: 1,
    },
  ];
}

export default router;
