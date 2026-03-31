import { Router } from "express";
import { db } from "@workspace/db";
import { aiSuggestionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const projectRouter = Router({ mergeParams: true });
const suggestionRouter = Router({ mergeParams: true });

projectRouter.get("/", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const { status } = req.query;

    let suggestions;
    if (status) {
      suggestions = await db.select().from(aiSuggestionsTable)
        .where(and(eq(aiSuggestionsTable.projectId, projectId), eq(aiSuggestionsTable.status, status as string)));
    } else {
      suggestions = await db.select().from(aiSuggestionsTable)
        .where(eq(aiSuggestionsTable.projectId, projectId));
    }

    res.json(suggestions.map(s => ({
      ...s,
      proposedChange: s.proposedChangeJson,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

suggestionRouter.post("/:suggestionId/accept", async (req, res) => {
  try {
    const suggestionId = parseInt(req.params.suggestionId);
    const [updated] = await db.update(aiSuggestionsTable)
      .set({ status: "accepted", resolvedAt: new Date() })
      .where(eq(aiSuggestionsTable.id, suggestionId))
      .returning();
    if (!updated) return res.status(404).json({ error: "Suggestion not found" });
    res.json({ ...updated, proposedChange: updated.proposedChangeJson });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

suggestionRouter.post("/:suggestionId/reject", async (req, res) => {
  try {
    const suggestionId = parseInt(req.params.suggestionId);
    const [updated] = await db.update(aiSuggestionsTable)
      .set({ status: "rejected", resolvedAt: new Date() })
      .where(eq(aiSuggestionsTable.id, suggestionId))
      .returning();
    if (!updated) return res.status(404).json({ error: "Suggestion not found" });
    res.json({ ...updated, proposedChange: updated.proposedChangeJson });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export { projectRouter as projectSuggestionsRouter, suggestionRouter };
