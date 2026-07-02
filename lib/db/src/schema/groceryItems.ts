import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const groceryItemsTable = pgTable("grocery_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  quantity: text("quantity"),
  category: text("category"),
  checked: boolean("checked").notNull().default(false),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGroceryItemSchema = createInsertSchema(groceryItemsTable).omit({
  id: true,
  addedAt: true,
});
export type InsertGroceryItem = z.infer<typeof insertGroceryItemSchema>;
export type GroceryItem = typeof groceryItemsTable.$inferSelect;
