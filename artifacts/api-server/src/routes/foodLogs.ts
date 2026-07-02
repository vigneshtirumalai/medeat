import { Router } from "express";
import { db, foodLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateFoodLogBody, DeleteFoodLogParams } from "@workspace/api-zod";

const router = Router();

router.get("/food-logs", async (req, res) => {
  try {
    const date = typeof req.query.date === "string" ? req.query.date : new Date().toISOString().split("T")[0];
    const logs = await db
      .select()
      .from(foodLogsTable)
      .where(eq(foodLogsTable.date, date));
    res.json(logs);
  } catch (err) {
    req.log.error({ err }, "Failed to list food logs");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.post("/food-logs", async (req, res) => {
  try {
    const body = CreateFoodLogBody.parse(req.body);
    const insertData = {
      date: typeof body.date === "string" ? body.date : (body.date as Date).toISOString().split("T")[0],
      foodName: body.foodName,
      calories: body.calories,
      proteinG: body.proteinG,
      carbsG: body.carbsG,
      fatG: body.fatG,
      mealType: body.mealType,
      servingSize: body.servingSize ?? null,
    };
    const [log] = await db.insert(foodLogsTable).values(insertData).returning();
    res.status(201).json(log);
  } catch (err) {
    req.log.error({ err }, "Failed to create food log");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/food-logs/:id", async (req, res) => {
  try {
    const { id } = DeleteFoodLogParams.parse({ id: Number(req.params.id) });
    await db.delete(foodLogsTable).where(eq(foodLogsTable.id, id));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete food log");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
