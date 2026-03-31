import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const wbsNodesTable = pgTable("wbs_nodes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"),
  code: text("code").notNull(),
  name: text("name").notNull(),
  level: integer("level").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWbsNodeSchema = createInsertSchema(wbsNodesTable).omit({ id: true, createdAt: true });
export type InsertWbsNode = z.infer<typeof insertWbsNodeSchema>;
export type WbsNode = typeof wbsNodesTable.$inferSelect;
