import { Router } from "express";
import { db, medicinesTable, doseLogsTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import {
  CreateMedicineBody,
  UpdateMedicineBody,
  TakeDoseBody,
  TakeDoseParams,
  RefillMedicineBody,
  GetMedicineParams,
  DeleteMedicineParams,
  UpdateMedicineParams,
  RefillMedicineParams,
  ListMedicinesQueryParams,
  ListDoseLogsQueryParams,
} from "@workspace/api-zod";

const router = Router();

function toDateString(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "string") return val;
  if (val instanceof Date) return val.toISOString().split("T")[0];
  return null;
}

router.get("/medicines", async (req, res) => {
  try {
    const query = ListMedicinesQueryParams.parse(req.query);
    let medicines = await db.select().from(medicinesTable).orderBy(desc(medicinesTable.createdAt));
    if (query.status && query.status !== "all") {
      medicines = medicines.filter((m) => m.status === query.status);
    } else if (!query.status) {
      medicines = medicines.filter((m) => m.status !== "finished");
    }
    res.json(medicines.map((m) => ({ ...m, timesOfDay: m.timesOfDay ?? [] })));
  } catch (err) {
    req.log.error({ err }, "Failed to list medicines");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/medicines", async (req, res) => {
  try {
    const body = CreateMedicineBody.parse(req.body);
    const [med] = await db
      .insert(medicinesTable)
      .values({
        name: body.name,
        dose: body.dose,
        form: body.form as string,
        frequency: body.frequency as string,
        timesOfDay: body.timesOfDay ?? [],
        pillCount: body.pillCount,
        refillThreshold: body.refillThreshold ?? 7,
        status: "active",
        foodInstruction: body.foodInstruction as string,
        prescriptionExpiry: toDateString(body.prescriptionExpiry),
        notes: body.notes ?? null,
      })
      .returning();
    res.status(201).json({ ...med, timesOfDay: med.timesOfDay ?? [] });
  } catch (err) {
    req.log.error({ err }, "Failed to create medicine");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/medicines/:id", async (req, res) => {
  try {
    const { id } = GetMedicineParams.parse({ id: Number(req.params.id) });
    const [med] = await db.select().from(medicinesTable).where(eq(medicinesTable.id, id));
    if (!med) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...med, timesOfDay: med.timesOfDay ?? [] });
  } catch (err) {
    req.log.error({ err }, "Failed to get medicine");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/medicines/:id", async (req, res) => {
  try {
    const { id } = UpdateMedicineParams.parse({ id: Number(req.params.id) });
    const body = UpdateMedicineBody.parse(req.body);
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.dose !== undefined) updateData.dose = body.dose;
    if (body.form !== undefined) updateData.form = body.form;
    if (body.frequency !== undefined) updateData.frequency = body.frequency;
    if (body.timesOfDay !== undefined) updateData.timesOfDay = body.timesOfDay;
    if (body.pillCount !== undefined) updateData.pillCount = body.pillCount;
    if (body.refillThreshold !== undefined) updateData.refillThreshold = body.refillThreshold;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.foodInstruction !== undefined) updateData.foodInstruction = body.foodInstruction;
    if (body.prescriptionExpiry !== undefined) updateData.prescriptionExpiry = toDateString(body.prescriptionExpiry);
    if (body.notes !== undefined) updateData.notes = body.notes;
    const [med] = await db
      .update(medicinesTable)
      .set(updateData)
      .where(eq(medicinesTable.id, id))
      .returning();
    if (!med) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...med, timesOfDay: med.timesOfDay ?? [] });
  } catch (err) {
    req.log.error({ err }, "Failed to update medicine");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/medicines/:id", async (req, res) => {
  try {
    const { id } = DeleteMedicineParams.parse({ id: Number(req.params.id) });
    await db.delete(medicinesTable).where(eq(medicinesTable.id, id));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete medicine");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/medicines/:id/take", async (req, res) => {
  try {
    const { id } = TakeDoseParams.parse({ id: Number(req.params.id) });
    const body = TakeDoseBody.parse(req.body);

    const [med] = await db.select().from(medicinesTable).where(eq(medicinesTable.id, id));
    if (!med) { res.status(404).json({ error: "Not found" }); return; }

    const newCount = body.status === "taken" ? Math.max(0, med.pillCount - 1) : med.pillCount;
    const [updatedMed] = await db
      .update(medicinesTable)
      .set({ pillCount: newCount })
      .where(eq(medicinesTable.id, id))
      .returning();

    const scheduledTime = typeof body.scheduledTime === "string" ? body.scheduledTime : null;
    const [doseLog] = await db
      .insert(doseLogsTable)
      .values({
        medicineId: id,
        status: body.status as string,
        scheduledTime,
      })
      .returning();

    const refillAlert = newCount <= (updatedMed.refillThreshold ?? 7);

    res.json({
      medicine: { ...updatedMed, timesOfDay: updatedMed.timesOfDay ?? [] },
      doseLog: { ...doseLog, medicineName: updatedMed.name },
      refillAlert,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to take dose");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.post("/medicines/:id/refill", async (req, res) => {
  try {
    const { id } = RefillMedicineParams.parse({ id: Number(req.params.id) });
    const body = RefillMedicineBody.parse(req.body);
    const [med] = await db
      .update(medicinesTable)
      .set({ pillCount: body.newCount })
      .where(eq(medicinesTable.id, id))
      .returning();
    if (!med) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...med, timesOfDay: med.timesOfDay ?? [] });
  } catch (err) {
    req.log.error({ err }, "Failed to refill medicine");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/dose-logs", async (req, res) => {
  try {
    const query = ListDoseLogsQueryParams.parse({
      medicineId: req.query.medicineId ? Number(req.query.medicineId) : undefined,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });

    const medicines = await db.select().from(medicinesTable);
    const medMap = new Map(medicines.map((m) => [m.id, m.name]));

    const conditions = [];
    if (query.medicineId) {
      conditions.push(eq(doseLogsTable.medicineId, query.medicineId));
    }

    const logs = await db
      .select()
      .from(doseLogsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(doseLogsTable.takenAt));

    const startDate = toDateString(query.startDate);
    const endDate = toDateString(query.endDate);

    const filtered = logs.filter((l) => {
      const date = l.takenAt.toISOString().split("T")[0];
      if (startDate && date < startDate) return false;
      if (endDate && date > endDate) return false;
      return true;
    });

    res.json(
      filtered.map((l) => ({
        ...l,
        medicineName: medMap.get(l.medicineId) ?? "Unknown",
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list dose logs");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
