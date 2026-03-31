import { Router } from "express";
import { db } from "@workspace/db";
import { dependenciesTable, tasksTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const projectRouter = Router({ mergeParams: true });
const depRouter = Router({ mergeParams: true });

function detectCycle(deps: { predecessorTaskId: number; successorTaskId: number }[], newPred: number, newSucc: number): boolean {
  const graph = new Map<number, number[]>();
  for (const d of deps) {
    if (!graph.has(d.predecessorTaskId)) graph.set(d.predecessorTaskId, []);
    graph.get(d.predecessorTaskId)!.push(d.successorTaskId);
  }
  if (!graph.has(newPred)) graph.set(newPred, []);
  graph.get(newPred)!.push(newSucc);

  const visited = new Set<number>();
  const stack = new Set<number>();

  function dfs(node: number): boolean {
    if (stack.has(node)) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    stack.add(node);
    for (const neighbor of (graph.get(node) || [])) {
      if (dfs(neighbor)) return true;
    }
    stack.delete(node);
    return false;
  }

  for (const node of graph.keys()) {
    if (dfs(node)) return true;
  }
  return false;
}

projectRouter.get("/", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const deps = await db.select().from(dependenciesTable).where(eq(dependenciesTable.projectId, projectId));
    res.json(deps);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

projectRouter.post("/", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const { predecessorTaskId, successorTaskId, relationshipType, lagValue, lagUnit } = req.body;

    if (!predecessorTaskId || !successorTaskId) {
      return res.status(400).json({ error: "predecessorTaskId and successorTaskId are required" });
    }

    if (predecessorTaskId === successorTaskId) {
      return res.status(400).json({ error: "A task cannot depend on itself" });
    }

    const existingDeps = await db.select().from(dependenciesTable).where(eq(dependenciesTable.projectId, projectId));
    
    if (detectCycle(existingDeps, predecessorTaskId, successorTaskId)) {
      return res.status(400).json({ error: "This dependency would create a cycle" });
    }

    const [dep] = await db.insert(dependenciesTable).values({
      projectId,
      predecessorTaskId,
      successorTaskId,
      relationshipType: relationshipType ?? "FS",
      lagValue: lagValue ?? 0,
      lagUnit: lagUnit ?? "days",
    }).returning();

    res.status(201).json(dep);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

depRouter.put("/:dependencyId", async (req, res) => {
  try {
    const dependencyId = parseInt(req.params.dependencyId);
    const { relationshipType, lagValue, lagUnit } = req.body;

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (relationshipType !== undefined) updateData.relationshipType = relationshipType;
    if (lagValue !== undefined) updateData.lagValue = lagValue;
    if (lagUnit !== undefined) updateData.lagUnit = lagUnit;

    const [updated] = await db.update(dependenciesTable)
      .set(updateData)
      .where(eq(dependenciesTable.id, dependencyId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Dependency not found" });
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

depRouter.delete("/:dependencyId", async (req, res) => {
  try {
    const dependencyId = parseInt(req.params.dependencyId);
    await db.delete(dependenciesTable).where(eq(dependenciesTable.id, dependencyId));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export { projectRouter as projectDepsRouter, depRouter };
