import { Router } from "express";
import { db } from "@workspace/db";
import { scheduleVersionsTable, tasksTable, dependenciesTable, wbsNodesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const versions = await db.select().from(scheduleVersionsTable)
      .where(eq(scheduleVersionsTable.projectId, projectId))
      .orderBy(desc(scheduleVersionsTable.versionNumber));

    res.json(versions.map(v => ({
      ...v,
      taskCount: (v.snapshotJson as { tasks?: unknown[] } | null)?.tasks?.length ?? 0,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const { name } = req.body;

    if (!name) return res.status(400).json({ error: "name is required" });

    const existing = await db.select().from(scheduleVersionsTable)
      .where(eq(scheduleVersionsTable.projectId, projectId))
      .orderBy(desc(scheduleVersionsTable.versionNumber));

    const nextVersion = existing.length > 0 ? existing[0].versionNumber + 1 : 1;

    const tasks = await db.select().from(tasksTable).where(eq(tasksTable.projectId, projectId));
    const deps = await db.select().from(dependenciesTable).where(eq(dependenciesTable.projectId, projectId));
    const wbsNodes = await db.select().from(wbsNodesTable).where(eq(wbsNodesTable.projectId, projectId));

    const snapshot = { tasks, dependencies: deps, wbsNodes, snapshotDate: new Date().toISOString() };

    const [version] = await db.insert(scheduleVersionsTable).values({
      projectId,
      name,
      versionNumber: nextVersion,
      snapshotJson: snapshot,
      createdBy: "User",
    }).returning();

    res.status(201).json({
      ...version,
      taskCount: tasks.length,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
