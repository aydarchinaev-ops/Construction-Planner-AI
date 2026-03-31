import { Router } from "express";
import { db } from "@workspace/db";
import { templatesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { category, industry } = req.query;
    let templates;

    if (category && industry) {
      templates = await db.select().from(templatesTable)
        .where(and(eq(templatesTable.category, category as string), eq(templatesTable.industry, industry as string)));
    } else if (category) {
      templates = await db.select().from(templatesTable).where(eq(templatesTable.category, category as string));
    } else if (industry) {
      templates = await db.select().from(templatesTable).where(eq(templatesTable.industry, industry as string));
    } else {
      templates = await db.select().from(templatesTable);
    }

    // Get task counts from template data
    const result = templates.map(t => ({
      id: t.id,
      name: t.name,
      category: t.category,
      industry: t.industry,
      description: t.description,
      version: t.version,
      isSystemTemplate: t.isSystemTemplate,
      taskCount: (t.templateData as { tasks?: unknown[] } | null)?.tasks?.length ?? 0,
    }));

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
