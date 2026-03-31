import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, tasksTable, dependenciesTable, wbsNodesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router({ mergeParams: true });

function generateP6Xml(project: Record<string, unknown>, tasks: Record<string, unknown>[], deps: Record<string, unknown>[], wbsNodes: Record<string, unknown>[]): string {
  const now = new Date().toISOString();

  const wbsXml = wbsNodes.map((w: Record<string, unknown>) => `
    <WBS>
      <ObjectId>${w.id}</ObjectId>
      <Code>${w.code}</Code>
      <Name>${w.name}</Name>
      <ProjectObjectId>${project.id}</ProjectObjectId>
      <ParentObjectId>${w.parentId ?? ""}</ParentObjectId>
      <SequenceNumber>${w.sortOrder}</SequenceNumber>
    </WBS>`).join("");

  const activitiesXml = tasks.map((t: Record<string, unknown>) => `
    <Activity>
      <ObjectId>${t.id}</ObjectId>
      <Id>${t.taskCode}</Id>
      <Name>${t.name}</Name>
      <ProjectObjectId>${project.id}</ProjectObjectId>
      <WBSObjectId>${t.wbsNodeId ?? ""}</WBSObjectId>
      <Type>${t.isMilestone ? "FinishMilestone" : (t.type === "summary" ? "WBS Summary" : "TaskDependent")}</Type>
      <Status>${t.status === "not_started" ? "Not Started" : t.status === "in_progress" ? "In Progress" : t.status === "completed" ? "Completed" : "Not Started"}</Status>
      <DurationObjectId>1</DurationObjectId>
      <PlannedDuration>${t.duration}</PlannedDuration>
      <PlannedStartDate>${t.startDate ?? ""}</PlannedStartDate>
      <PlannedFinishDate>${t.endDate ?? ""}</PlannedFinishDate>
      <PercentComplete>${t.percentComplete ?? 0}</PercentComplete>
      <PrimaryResourceId></PrimaryResourceId>
    </Activity>`).join("");

  const relationshipsXml = deps.map((d: Record<string, unknown>) => `
    <Relationship>
      <ObjectId>${d.id}</ObjectId>
      <PredecessorActivityObjectId>${d.predecessorTaskId}</PredecessorActivityObjectId>
      <SuccessorActivityObjectId>${d.successorTaskId}</SuccessorActivityObjectId>
      <Type>${d.relationshipType}</Type>
      <Lag>${d.lagValue}</Lag>
    </Relationship>`).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<APIBusinessObjects>
  <Project>
    <ObjectId>${project.id}</ObjectId>
    <Id>PROJ-${project.id}</Id>
    <Name>${project.name}</Name>
    <Description>${project.description ?? ""}</Description>
    <StartDate>${project.startDate ?? ""}</StartDate>
    <FinishDate>${project.targetFinishDate ?? ""}</FinishDate>
    <Status>${project.status}</Status>
    <ExportedAt>${now}</ExportedAt>
  </Project>
  <WBSList>${wbsXml}
  </WBSList>
  <ActivityList>${activitiesXml}
  </ActivityList>
  <RelationshipList>${relationshipsXml}
  </RelationshipList>
</APIBusinessObjects>`;
}

router.post("/p6-xml", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) return res.status(404).json({ error: "Project not found" });

    const tasks = await db.select().from(tasksTable).where(eq(tasksTable.projectId, projectId));
    const deps = await db.select().from(dependenciesTable).where(eq(dependenciesTable.projectId, projectId));
    const wbsNodes = await db.select().from(wbsNodesTable).where(eq(wbsNodesTable.projectId, projectId));

    const xmlContent = generateP6Xml(
      project as unknown as Record<string, unknown>,
      tasks as unknown as Record<string, unknown>[],
      deps as unknown as Record<string, unknown>[],
      wbsNodes as unknown as Record<string, unknown>[]
    );

    const filename = `${project.name.replace(/[^a-z0-9]/gi, "_")}_P6_Export_${new Date().toISOString().split("T")[0]}.xml`;

    res.json({
      projectId,
      format: "P6-XML",
      filename,
      content: xmlContent,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
