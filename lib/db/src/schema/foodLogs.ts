import { pgTable, text, serial, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const foodLogsTable = pgTable("food_logs", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  foodName: text("food_name").notNull(),
  calories: real("calories").notNull().default(0),
  proteinG: real("protein_g").notNull().default(0),
  carbsG: real("carbs_g").notNull().default(0),
  fatG: real("fat_g").notNull().default(0),
  mealType: text("meal_type").notNull().default("snack"),
  servingSize: text("serving_size"),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFoodLogSchema = createInsertSchema(foodLogsTable).omit({
  id: true,
  loggedAt: true,
});
export type InsertFoodLog = z.infer<typeof insertFoodLogSchema>;
export type FoodLog = typeof foodLogsTable.$inferSelect;
