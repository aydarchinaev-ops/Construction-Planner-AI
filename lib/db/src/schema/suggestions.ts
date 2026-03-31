import { pgTable, serial, integer, text, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const aiSuggestionsTable = pgTable("ai_suggestions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(),
  targetId: integer("target_id"),
  suggestionType: text("suggestion_type").notNull(),
  message: text("message").notNull(),
  severity: text("severity").notNull().default("warning"),
  proposedChangeJson: json("proposed_change_json"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const insertAiSuggestionSchema = createInsertSchema(aiSuggestionsTable).omit({ id: true, createdAt: true });
export type InsertAiSuggestion = z.infer<typeof insertAiSuggestionSchema>;
export type AiSuggestion = typeof aiSuggestionsTable.$inferSelect;
