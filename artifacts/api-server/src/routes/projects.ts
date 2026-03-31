import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, tasksTable, dependenciesTable, aiSuggestionsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const projects = await db.select().from(projectsTable).orderBy(projectsTable.createdAt);
    res.json(projects);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, description, projectType, industry, location, capacity, executionModel, contractStrategy, startDate, targetFinishDate } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    const [project] = await db.insert(projectsTable).values({
      name,
      description,
      projectType,
      industry,
      location,
      capacity,
      executionModel,
      contractStrategy,
      startDate,
      targetFinishDate,
      status: "draft",
    }).returning();

    res.status(201).json(project);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:projectId", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:projectId", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const { name, description, projectType, industry, location, capacity, executionModel, contractStrategy, startDate, targetFinishDate, status } = req.body;

    const [updated] = await db.update(projectsTable)
      .set({ name, description, projectType, industry, location, capacity, executionModel, contractStrategy, startDate, targetFinishDate, status, updatedAt: new Date() })
      .where(eq(projectsTable.id, projectId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Project not found" });
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:projectId", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    await db.delete(projectsTable).where(eq(projectsTable.id, projectId));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:projectId/summary", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);

    const tasks = await db.select().from(tasksTable).where(eq(tasksTable.projectId, projectId));
    const deps = await db.select().from(dependenciesTable).where(eq(dependenciesTable.projectId, projectId));
    const suggestions = await db.select().from(aiSuggestionsTable).where(eq(aiSuggestionsTable.projectId, projectId));

    const totalTasks = tasks.filter(t => !t.isMilestone).length;
    const totalMilestones = tasks.filter(t => t.isMilestone).length;
    const totalDependencies = deps.length;

    const tasksByStatus: Record<string, number> = {};
    const tasksByDiscipline: Record<string, number> = {};
    let totalComplete = 0;

    for (const task of tasks) {
      tasksByStatus[task.status] = (tasksByStatus[task.status] || 0) + 1;
      if (task.discipline) {
        tasksByDiscipline[task.discipline] = (tasksByDiscipline[task.discipline] || 0) + 1;
      }
      totalComplete += parseFloat(task.percentComplete?.toString() || "0");
    }

    const completionPercentage = tasks.length > 0 ? totalComplete / tasks.length : 0;
    const pendingSuggestions = suggestions.filter(s => s.status === "pending").length;

    res.json({
      projectId,
      totalTasks,
      totalMilestones,
      totalDependencies,
      tasksByStatus,
      tasksByDiscipline,
      completionPercentage: Math.round(completionPercentage * 10) / 10,
      criticalPathLength: tasks.length,
      pendingSuggestions,
      validationIssues: 0,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
