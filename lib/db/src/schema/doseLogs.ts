import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { medicinesTable } from "./medicines";

export const doseLogsTable = pgTable("dose_logs", {
  id: serial("id").primaryKey(),
  medicineId: integer("medicine_id")
    .notNull()
    .references(() => medicinesTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("taken"),
  scheduledTime: text("scheduled_time"),
  takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDoseLogSchema = createInsertSchema(doseLogsTable).omit({
  id: true,
  takenAt: true,
});
export type InsertDoseLog = z.infer<typeof insertDoseLogSchema>;
export type DoseLog = typeof doseLogsTable.$inferSelect;
