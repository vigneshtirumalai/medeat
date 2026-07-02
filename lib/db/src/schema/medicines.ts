import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const medicinesTable = pgTable("medicines", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  dose: text("dose").notNull(),
  form: text("form").notNull().default("tablet"),
  frequency: text("frequency").notNull().default("daily"),
  timesOfDay: text("times_of_day").array().notNull().default([]),
  pillCount: integer("pill_count").notNull().default(0),
  refillThreshold: integer("refill_threshold").notNull().default(7),
  status: text("status").notNull().default("active"),
  foodInstruction: text("food_instruction").notNull().default("any"),
  prescriptionExpiry: text("prescription_expiry"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMedicineSchema = createInsertSchema(medicinesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMedicine = z.infer<typeof insertMedicineSchema>;
export type Medicine = typeof medicinesTable.$inferSelect;
