import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable, dependenciesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router({ mergeParams: true });

interface ValidationIssue {
  type: "error" | "warning";
  code: string;
  message: string;
  affectedTaskIds: number[];
  affectedDependencyIds: number[];
}

function detectCycles(tasks: { id: number }[], deps: { predecessorTaskId: number; successorTaskId: number; id: number }[]): number[][] {
  const graph = new Map<number, number[]>();
  const depMap = new Map<string, number>();

  for (const d of deps) {
    if (!graph.has(d.predecessorTaskId)) graph.set(d.predecessorTaskId, []);
    graph.get(d.predecessorTaskId)!.push(d.successorTaskId);
    depMap.set(`${d.predecessorTaskId}-${d.successorTaskId}`, d.id);
  }

  const visited = new Set<number>();
  const stack: number[] = [];
  const cycles: number[][] = [];

  function dfs(node: number, path: number[]): void {
    if (stack.includes(node)) {
      const cycleStart = path.indexOf(node);
      cycles.push(path.slice(cycleStart));
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    stack.push(node);
    for (const neighbor of (graph.get(node) || [])) {
      dfs(neighbor, [...path, node]);
    }
    stack.pop();
  }

  for (const task of tasks) {
    if (!visited.has(task.id)) {
      dfs(task.id, []);
    }
  }

  return cycles;
}

router.get("/", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);

    const tasks = await db.select().from(tasksTable).where(eq(tasksTable.projectId, projectId));
    const deps = await db.select().from(dependenciesTable).where(eq(dependenciesTable.projectId, projectId));

    const issues: ValidationIssue[] = [];

    if (tasks.length === 0) {
      issues.push({
        type: "warning",
        code: "EMPTY_SCHEDULE",
        message: "No tasks found. Generate a schedule or add tasks to begin planning.",
        affectedTaskIds: [],
        affectedDependencyIds: [],
      });
      return res.json({ projectId, isValid: true, errorCount: 0, warningCount: 1, issues });
    }

    // 1. Cycle detection
    const cycles = detectCycles(tasks, deps);
    for (const cycle of cycles) {
      issues.push({
        type: "error",
        code: "DEPENDENCY_CYCLE",
        message: `Circular dependency detected involving ${cycle.length} tasks. This prevents schedule calculation.`,
        affectedTaskIds: cycle,
        affectedDependencyIds: [],
      });
    }

    // 2. Orphan tasks (no predecessors, no successors) — excluding milestones and PM tasks
    const hasSuccessor = new Set(deps.map(d => d.predecessorTaskId));
    const hasPredecessor = new Set(deps.map(d => d.successorTaskId));

    const nonPMTasks = tasks.filter(t => t.discipline !== "PM" && t.type !== "summary");
    const orphans = nonPMTasks.filter(t => !hasSuccessor.has(t.id) && !hasPredecessor.has(t.id));
    if (orphans.length > 0) {
      issues.push({
        type: "warning",
        code: "ORPHAN_TASKS",
        message: `${orphans.length} task(s) have no predecessors or successors and are not connected to the schedule network.`,
        affectedTaskIds: orphans.map(t => t.id),
        affectedDependencyIds: [],
      });
    }

    // 3. Tasks without end dates or start dates
    const missingDates = tasks.filter(t => t.type === "task" && (!t.startDate || !t.endDate));
    if (missingDates.length > 0) {
      issues.push({
        type: "warning",
        code: "MISSING_DATES",
        message: `${missingDates.length} task(s) are missing start or end dates.`,
        affectedTaskIds: missingDates.map(t => t.id),
        affectedDependencyIds: [],
      });
    }

    // 4. Duration outliers — tasks with 0 duration that are not milestones
    const zeroDuration = tasks.filter(t => !t.isMilestone && t.type === "task" && t.duration === 0);
    if (zeroDuration.length > 0) {
      issues.push({
        type: "error",
        code: "ZERO_DURATION",
        message: `${zeroDuration.length} non-milestone task(s) have zero duration.`,
        affectedTaskIds: zeroDuration.map(t => t.id),
        affectedDependencyIds: [],
      });
    }

    // 5. Very long duration tasks (>365 days)
    const longTasks = tasks.filter(t => t.durationUnit === "days" && t.duration > 365);
    if (longTasks.length > 0) {
      issues.push({
        type: "warning",
        code: "EXCESSIVE_DURATION",
        message: `${longTasks.length} task(s) have durations exceeding 365 days. Consider breaking these into sub-tasks.`,
        affectedTaskIds: longTasks.map(t => t.id),
        affectedDependencyIds: [],
      });
    }

    // 6. Tasks missing discipline classification
    const nonMilestones = tasks.filter(t => !t.isMilestone && t.type === "task");
    const missingDiscipline = nonMilestones.filter(t => !t.discipline);
    if (missingDiscipline.length > 0) {
      issues.push({
        type: "warning",
        code: "MISSING_DISCIPLINE",
        message: `${missingDiscipline.length} task(s) have no discipline assigned. Discipline classification is required for resource and reporting purposes.`,
        affectedTaskIds: missingDiscipline.map(t => t.id),
        affectedDependencyIds: [],
      });
    }

    // 7. Check for tasks that finish before they start
    const invalidDates = tasks.filter(t => t.startDate && t.endDate && new Date(t.endDate) < new Date(t.startDate));
    if (invalidDates.length > 0) {
      issues.push({
        type: "error",
        code: "INVALID_DATE_RANGE",
        message: `${invalidDates.length} task(s) have end dates before their start dates.`,
        affectedTaskIds: invalidDates.map(t => t.id),
        affectedDependencyIds: [],
      });
    }

    const errorCount = issues.filter(i => i.type === "error").length;
    const warningCount = issues.filter(i => i.type === "warning").length;

    res.json({
      projectId,
      isValid: errorCount === 0,
      errorCount,
      warningCount,
      issues,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
