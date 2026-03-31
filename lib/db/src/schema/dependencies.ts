import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { tasksTable } from "./tasks";

export const dependenciesTable = pgTable("dependencies", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  predecessorTaskId: integer("predecessor_task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  successorTaskId: integer("successor_task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  relationshipType: text("relationship_type").notNull().default("FS"),
  lagValue: integer("lag_value").notNull().default(0),
  lagUnit: text("lag_unit").notNull().default("days"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDependencySchema = createInsertSchema(dependenciesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDependency = z.infer<typeof insertDependencySchema>;
export type Dependency = typeof dependenciesTable.$inferSelect;
