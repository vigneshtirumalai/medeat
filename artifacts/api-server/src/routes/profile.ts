import { Router } from "express";
import { db, userProfileTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateProfileBody } from "@workspace/api-zod";

const router = Router();

async function getOrCreateProfile() {
  const [existing] = await db.select().from(userProfileTable);
  if (existing) return existing;
  const [created] = await db
    .insert(userProfileTable)
    .values({
      calorieGoal: 2000,
      proteinGoalG: 120,
      carbsGoalG: 250,
      fatGoalG: 65,
      allergens: [],
      cuisinePreferences: [],
    })
    .returning();
  return created;
}

router.get("/profile", async (req, res) => {
  try {
    const profile = await getOrCreateProfile();
    res.json({
      ...profile,
      allergens: profile.allergens ?? [],
      cuisinePreferences: profile.cuisinePreferences ?? [],
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/profile", async (req, res) => {
  try {
    const body = UpdateProfileBody.parse(req.body);
    const existing = await getOrCreateProfile();
    const [updated] = await db
      .update(userProfileTable)
      .set(body)
      .where(eq(userProfileTable.id, existing.id))
      .returning();
    res.json({
      ...updated,
      allergens: updated.allergens ?? [],
      cuisinePreferences: updated.cuisinePreferences ?? [],
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update profile");
    res.status(400).json({ error: "Invalid request" });
  }
});

export default router;
