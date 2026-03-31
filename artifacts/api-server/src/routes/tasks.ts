import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const projectRouter = Router({ mergeParams: true });
const taskRouter = Router({ mergeParams: true });

projectRouter.get("/", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    let query = db.select().from(tasksTable).where(eq(tasksTable.projectId, projectId));
    const tasks = await query.orderBy(tasksTable.sortOrder, tasksTable.id);
    res.json(tasks.map(t => ({ ...t, percentComplete: parseFloat(t.percentComplete?.toString() || "0") })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

projectRouter.post("/", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const { wbsNodeId, parentTaskId, taskCode, name, type, discipline, area, duration, durationUnit, startDate, endDate, isMilestone, notes, sortOrder } = req.body;

    if (!name) return res.status(400).json({ error: "name is required" });

    const existingCount = await db.select().from(tasksTable).where(eq(tasksTable.projectId, projectId));
    const autoCode = taskCode || `T${String(existingCount.length + 1).padStart(4, "0")}`;

    const [task] = await db.insert(tasksTable).values({
      projectId,
      wbsNodeId: wbsNodeId ?? null,
      parentTaskId: parentTaskId ?? null,
      taskCode: autoCode,
      name,
      type: type ?? "task",
      discipline: discipline ?? null,
      area: area ?? null,
      duration: duration ?? 1,
      durationUnit: durationUnit ?? "days",
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      isMilestone: isMilestone ?? false,
      percentComplete: "0",
      status: "not_started",
      notes: notes ?? null,
      sortOrder: sortOrder ?? existingCount.length,
    }).returning();

    res.status(201).json({ ...task, percentComplete: parseFloat(task.percentComplete?.toString() || "0") });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

taskRouter.get("/:taskId", async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json({ ...task, percentComplete: parseFloat(task.percentComplete?.toString() || "0") });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

taskRouter.put("/:taskId", async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const { name, type, discipline, area, duration, durationUnit, startDate, endDate, isMilestone, percentComplete, status, notes, sortOrder, wbsNodeId, parentTaskId } = req.body;

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (discipline !== undefined) updateData.discipline = discipline;
    if (area !== undefined) updateData.area = area;
    if (duration !== undefined) updateData.duration = duration;
    if (durationUnit !== undefined) updateData.durationUnit = durationUnit;
    if (startDate !== undefined) updateData.startDate = startDate;
    if (endDate !== undefined) updateData.endDate = endDate;
    if (isMilestone !== undefined) updateData.isMilestone = isMilestone;
    if (percentComplete !== undefined) updateData.percentComplete = String(percentComplete);
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (wbsNodeId !== undefined) updateData.wbsNodeId = wbsNodeId;
    if (parentTaskId !== undefined) updateData.parentTaskId = parentTaskId;

    const [updated] = await db.update(tasksTable)
      .set(updateData)
      .where(eq(tasksTable.id, taskId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Task not found" });
    res.json({ ...updated, percentComplete: parseFloat(updated.percentComplete?.toString() || "0") });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

taskRouter.delete("/:taskId", async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    await db.delete(tasksTable).where(eq(tasksTable.id, taskId));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export { projectRouter as projectTasksRouter, taskRouter };
