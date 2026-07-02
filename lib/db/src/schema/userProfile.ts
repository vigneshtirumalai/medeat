import { pgTable, text, serial, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userProfileTable = pgTable("user_profile", {
  id: serial("id").primaryKey(),
  calorieGoal: integer("calorie_goal").notNull().default(2000),
  proteinGoalG: integer("protein_goal_g").notNull().default(120),
  carbsGoalG: integer("carbs_goal_g").notNull().default(250),
  fatGoalG: integer("fat_goal_g").notNull().default(65),
  allergens: text("allergens").array().notNull().default([]),
  weightKg: real("weight_kg"),
  heightCm: real("height_cm"),
  ageYears: integer("age_years"),
  activityLevel: text("activity_level"),
  healthGoal: text("health_goal"),
  cuisinePreferences: text("cuisine_preferences").array().notNull().default([]),
});

export const insertUserProfileSchema = createInsertSchema(userProfileTable).omit({
  id: true,
});
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfileTable.$inferSelect;
