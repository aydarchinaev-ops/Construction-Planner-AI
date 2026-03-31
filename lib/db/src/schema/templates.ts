import { pgTable, serial, text, boolean, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const templatesTable = pgTable("templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  industry: text("industry").notNull(),
  description: text("description").notNull(),
  version: text("version").notNull().default("1.0"),
  isSystemTemplate: boolean("is_system_template").notNull().default(true),
  templateData: json("template_data"),
});

export const insertTemplateSchema = createInsertSchema(templatesTable).omit({ id: true });
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Template = typeof templatesTable.$inferSelect;
