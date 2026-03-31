import { pgTable, serial, text, integer, boolean, numeric, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  wbsNodeId: integer("wbs_node_id"),
  parentTaskId: integer("parent_task_id"),
  taskCode: text("task_code").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().default("task"),
  discipline: text("discipline"),
  area: text("area"),
  duration: integer("duration").notNull().default(1),
  durationUnit: text("duration_unit").notNull().default("days"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  isMilestone: boolean("is_milestone").notNull().default(false),
  percentComplete: numeric("percent_complete").notNull().default("0"),
  status: text("status").notNull().default("not_started"),
  constraintType: text("constraint_type"),
  constraintDate: date("constraint_date"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
