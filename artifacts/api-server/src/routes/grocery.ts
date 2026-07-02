import { Router } from "express";
import { db, groceryItemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateGroceryItemBody,
  UpdateGroceryItemBody,
  UpdateGroceryItemParams,
  DeleteGroceryItemParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/grocery", async (req, res) => {
  try {
    const items = await db
      .select()
      .from(groceryItemsTable)
      .orderBy(groceryItemsTable.addedAt);
    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Failed to list grocery items");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/grocery", async (req, res) => {
  try {
    const body = CreateGroceryItemBody.parse(req.body);
    const [item] = await db.insert(groceryItemsTable).values({
      name: body.name,
      quantity: body.quantity ?? null,
      category: body.category ?? null,
    }).returning();
    res.status(201).json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to create grocery item");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.patch("/grocery/:id", async (req, res) => {
  try {
    const { id } = UpdateGroceryItemParams.parse({ id: Number(req.params.id) });
    const body = UpdateGroceryItemBody.parse(req.body);
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.quantity !== undefined) updateData.quantity = body.quantity;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.checked !== undefined) updateData.checked = body.checked;
    const [item] = await db
      .update(groceryItemsTable)
      .set(updateData)
      .where(eq(groceryItemsTable.id, id))
      .returning();
    if (!item) { res.status(404).json({ error: "Not found" }); return; }
    res.json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to update grocery item");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/grocery/:id", async (req, res) => {
  try {
    const { id } = DeleteGroceryItemParams.parse({ id: Number(req.params.id) });
    await db.delete(groceryItemsTable).where(eq(groceryItemsTable.id, id));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete grocery item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/grocery/clear-checked", async (req, res) => {
  try {
    await db
      .delete(groceryItemsTable)
      .where(eq(groceryItemsTable.checked, true));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to clear checked grocery items");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
