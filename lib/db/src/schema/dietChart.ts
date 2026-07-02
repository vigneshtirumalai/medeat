import { pgTable, text, serial, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dietChartTable = pgTable("diet_chart", {
  id: serial("id").primaryKey(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  rawText: text("raw_text").notNull().default(""),
  caloriesKcal: real("calories_kcal").notNull().default(2000),
  proteinG: real("protein_g").notNull().default(120),
  carbsG: real("carbs_g").notNull().default(250),
  fatG: real("fat_g").notNull().default(65),
  notes: text("notes"),
});

export const insertDietChartSchema = createInsertSchema(dietChartTable).omit({
  id: true,
  uploadedAt: true,
});
export type InsertDietChart = z.infer<typeof insertDietChartSchema>;
export type DietChart = typeof dietChartTable.$inferSelect;
