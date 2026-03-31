import { Router } from "express";
import { db } from "@workspace/db";
import { wbsNodesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const nodes = await db.select().from(wbsNodesTable)
      .where(eq(wbsNodesTable.projectId, projectId))
      .orderBy(wbsNodesTable.level, wbsNodesTable.sortOrder);
    res.json(nodes);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const { parentId, code, name, level, sortOrder } = req.body;

    if (!code || !name) return res.status(400).json({ error: "code and name are required" });

    const [node] = await db.insert(wbsNodesTable).values({
      projectId,
      parentId: parentId ?? null,
      code,
      name,
      level: level ?? 1,
      sortOrder: sortOrder ?? 0,
    }).returning();

    res.status(201).json(node);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
