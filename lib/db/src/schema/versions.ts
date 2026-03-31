import { pgTable, serial, integer, text, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const scheduleVersionsTable = pgTable("schedule_versions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  versionNumber: integer("version_number").notNull().default(1),
  snapshotJson: json("snapshot_json"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by"),
});

export const insertScheduleVersionSchema = createInsertSchema(scheduleVersionsTable).omit({ id: true, createdAt: true });
export type InsertScheduleVersion = z.infer<typeof insertScheduleVersionSchema>;
export type ScheduleVersion = typeof scheduleVersionsTable.$inferSelect;
