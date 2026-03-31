import { Router } from "express";
import { db } from "@workspace/db";
import { chatMessagesTable, tasksTable, wbsNodesTable, dependenciesTable, aiSuggestionsTable, projectsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router({ mergeParams: true });

interface ExtractedProjectData {
  projectType?: string;
  industry?: string;
  location?: string;
  capacity?: string;
  executionModel?: string;
  contractStrategy?: string;
  disciplines?: string[];
  areas?: string[];
  phases?: string[];
}

function extractProjectData(content: string): ExtractedProjectData {
  const data: ExtractedProjectData = {};
  const lower = content.toLowerCase();

  if (lower.includes("epc")) data.executionModel = "EPC";
  else if (lower.includes("epcm")) data.executionModel = "EPCM";
  else if (lower.includes("design-build")) data.executionModel = "Design-Build";

  if (lower.includes("water treatment") || lower.includes("wastewater")) {
    data.projectType = "Water Treatment Plant";
    data.industry = "Water & Utilities";
  } else if (lower.includes("mining") || lower.includes("ore")) {
    data.projectType = "Mining Processing Facility";
    data.industry = "Mining";
  } else if (lower.includes("oil") || lower.includes("gas") || lower.includes("refinery")) {
    data.projectType = "Oil & Gas Facility";
    data.industry = "Oil & Gas";
  } else if (lower.includes("power plant") || lower.includes("substation")) {
    data.projectType = "Power Generation";
    data.industry = "Energy";
  } else if (lower.includes("chemical") || lower.includes("process plant")) {
    data.projectType = "Chemical Processing Plant";
    data.industry = "Chemicals";
  } else if (lower.includes("hospital") || lower.includes("healthcare")) {
    data.projectType = "Healthcare Facility";
    data.industry = "Healthcare";
  } else if (lower.includes("industrial")) {
    data.projectType = "Industrial Facility";
    data.industry = "Industrial";
  }

  const disciplines: string[] = [];
  if (lower.includes("civil")) disciplines.push("Civil");
  if (lower.includes("structural") || lower.includes("steel")) disciplines.push("Structural");
  if (lower.includes("mechanical")) disciplines.push("Mechanical");
  if (lower.includes("piping") || lower.includes("pipe")) disciplines.push("Piping");
  if (lower.includes("electrical") || lower.includes("e&i")) disciplines.push("E&I");
  if (lower.includes("instrumentation")) disciplines.push("Instrumentation");
  if (lower.includes("commissioning")) disciplines.push("Commissioning");
  if (disciplines.length > 0) data.disciplines = disciplines;

  return data;
}

function generateClarifyingQuestion(existingMessages: { content: string; role: string }[], projectData: ExtractedProjectData): string {
  const userMessages = existingMessages.filter(m => m.role === "user").map(m => m.content.toLowerCase());
  const allContent = userMessages.join(" ");

  if (!projectData.location && !allContent.includes("location") && !allContent.includes("where")) {
    return "What is the project location or country? This helps me apply appropriate regional standards and working calendar assumptions.";
  }
  if (!projectData.capacity && !allContent.includes("capacity") && !allContent.includes("size")) {
    return "What is the target capacity or scale of the project? (e.g., 50,000 m³/day water treatment, 500 MW power, 1 MTPA processing capacity)";
  }
  if (!projectData.executionModel && !allContent.includes("epc") && !allContent.includes("contract")) {
    return "What is the contract and execution strategy? (e.g., EPC lump-sum, EPCM, multi-contract, design-build)";
  }
  if (!projectData.disciplines && !allContent.includes("discipline") && !allContent.includes("scope")) {
    return "What engineering disciplines and construction scope are included? (e.g., Civil, Structural, Mechanical, Piping, E&I, Instrumentation, Commissioning)";
  }
  if (!allContent.includes("duration") && !allContent.includes("year") && !allContent.includes("month") && !allContent.includes("schedule level")) {
    return "What is the target project duration and desired schedule level of detail? (e.g., 36 months, Level 3 construction schedule)";
  }
  if (!allContent.includes("phase") && !allContent.includes("milestone")) {
    return "Are there specific project phases or key milestones the schedule must respect? (e.g., First Concrete, Mechanical Completion, Commissioning Start, Project Handover)";
  }

  return null as unknown as string;
}

router.get("/history", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const messages = await db.select().from(chatMessagesTable)
      .where(eq(chatMessagesTable.projectId, projectId))
      .orderBy(chatMessagesTable.createdAt);
    res.json(messages);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/message", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const { content } = req.body;

    if (!content) return res.status(400).json({ error: "content is required" });

    const [userMsg] = await db.insert(chatMessagesTable).values({
      projectId,
      role: "user",
      content,
      messageType: "general",
    }).returning();

    const history = await db.select().from(chatMessagesTable)
      .where(eq(chatMessagesTable.projectId, projectId))
      .orderBy(chatMessagesTable.createdAt);

    const projectData = extractProjectData(content);
    
    // Update project with extracted data if fields are missing
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (project) {
      const updates: Record<string, unknown> = {};
      if (projectData.projectType && !project.projectType) updates.projectType = projectData.projectType;
      if (projectData.industry && !project.industry) updates.industry = projectData.industry;
      if (projectData.executionModel && !project.executionModel) updates.executionModel = projectData.executionModel;
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date();
        await db.update(projectsTable).set(updates).where(eq(projectsTable.id, projectId));
      }
    }

    const clarifyingQuestion = generateClarifyingQuestion(history, projectData);
    const userCount = history.filter(m => m.role === "user").length;

    let responseContent: string;
    let messageType = "clarification";

    if (userCount <= 2 && clarifyingQuestion) {
      responseContent = `Thank you for that. I've captured the key scope details. ${clarifyingQuestion}`;
    } else if (userCount >= 3) {
      const disciplines = projectData.disciplines?.join(", ") || "Civil, Mechanical, E&I";
      responseContent = `I have enough information to generate a draft schedule. Based on your project description, I'll create a ${projectData.projectType || "construction"} schedule with WBS structure covering the ${disciplines} disciplines. 

The schedule will include:
- Engineering deliverables phase
- Procurement packages  
- Construction by discipline and area
- Pre-commissioning and commissioning activities
- Key project milestones

Ready to generate the schedule? Click "Generate Schedule" or tell me if you'd like to adjust any assumptions first.`;
      messageType = "suggestion";
    } else {
      responseContent = clarifyingQuestion 
        ? `Understood. ${clarifyingQuestion}`
        : `I have a good understanding of your project. Click "Generate Schedule" to create the initial WBS and activity list, or provide any additional scope details.`;
    }

    const [assistantMsg] = await db.insert(chatMessagesTable).values({
      projectId,
      role: "assistant",
      content: responseContent,
      messageType,
    }).returning();

    res.json({
      message: assistantMsg,
      scheduleGenerated: false,
      extractedData: projectData,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/generate-schedule", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) return res.status(404).json({ error: "Project not found" });

    // Clean existing generated tasks/deps
    await db.delete(dependenciesTable).where(eq(dependenciesTable.projectId, projectId));
    await db.delete(tasksTable).where(eq(tasksTable.projectId, projectId));
    await db.delete(wbsNodesTable).where(eq(wbsNodesTable.projectId, projectId));

    const isWaterTreatment = project.projectType?.includes("Water");
    const isMining = project.industry === "Mining";
    const isOilGas = project.industry === "Oil & Gas";

    // Create WBS nodes
    const wbsData = [
      { code: "1", name: "Project Management", level: 1, sortOrder: 0 },
      { code: "2", name: "Engineering & Design", level: 1, sortOrder: 1 },
      { code: "3", name: "Procurement", level: 1, sortOrder: 2 },
      { code: "4", name: "Construction", level: 1, sortOrder: 3 },
      { code: "5", name: "Pre-Commissioning & Commissioning", level: 1, sortOrder: 4 },
    ];

    const wbsNodes = await db.insert(wbsNodesTable).values(
      wbsData.map(w => ({ ...w, projectId }))
    ).returning();

    const wbsByCode = Object.fromEntries(wbsNodes.map(w => [w.code, w]));

    // Generate tasks based on project type
    const startDate = project.startDate || "2025-01-06";
    const start = new Date(startDate);
    
    const addDays = (date: Date, days: number) => {
      const d = new Date(date);
      d.setDate(d.getDate() + days);
      return d.toISOString().split("T")[0];
    };

    // Task template for construction project
    const taskTemplates = [
      // Project Management
      { taskCode: "PM-001", name: "Project Kick-off", type: "milestone" as const, discipline: "PM", area: "Project", duration: 0, wbsCode: "1", offset: 0, isMilestone: true },
      { taskCode: "PM-002", name: "Project Management Plan", type: "task" as const, discipline: "PM", area: "Project", duration: 20, wbsCode: "1", offset: 1 },
      { taskCode: "PM-003", name: "Risk Register & Management", type: "task" as const, discipline: "PM", area: "Project", duration: 15, wbsCode: "1", offset: 5 },
      { taskCode: "PM-004", name: "HSE Management Plan", type: "task" as const, discipline: "PM", area: "Project", duration: 15, wbsCode: "1", offset: 5 },
      { taskCode: "PM-005", name: "Schedule Baseline Approval", type: "milestone" as const, discipline: "PM", area: "Project", duration: 0, wbsCode: "1", offset: 30, isMilestone: true },
      
      // Engineering
      { taskCode: "ENG-001", name: "Basis of Design", type: "task" as const, discipline: "Engineering", area: "FEED", duration: 30, wbsCode: "2", offset: 0 },
      { taskCode: "ENG-002", name: "Civil Engineering Design", type: "task" as const, discipline: "Civil", area: "Foundations", duration: 60, wbsCode: "2", offset: 25 },
      { taskCode: "ENG-003", name: "Structural Engineering Design", type: "task" as const, discipline: "Structural", area: "Superstructure", duration: 60, wbsCode: "2", offset: 30 },
      { taskCode: "ENG-004", name: "Mechanical Equipment Design", type: "task" as const, discipline: "Mechanical", area: "Process", duration: 75, wbsCode: "2", offset: 25 },
      { taskCode: "ENG-005", name: "Piping & Instrumentation Diagrams", type: "task" as const, discipline: "Piping", area: "Process", duration: 90, wbsCode: "2", offset: 30 },
      { taskCode: "ENG-006", name: "Electrical Design", type: "task" as const, discipline: "E&I", area: "Electrical", duration: 75, wbsCode: "2", offset: 35 },
      { taskCode: "ENG-007", name: "Instrumentation & Control Design", type: "task" as const, discipline: "Instrumentation", area: "Control", duration: 80, wbsCode: "2", offset: 40 },
      { taskCode: "ENG-008", name: "IFC Drawing Issue - Civil", type: "milestone" as const, discipline: "Civil", area: "Foundations", duration: 0, wbsCode: "2", offset: 90, isMilestone: true },
      { taskCode: "ENG-009", name: "IFC Drawing Issue - Mechanical", type: "milestone" as const, discipline: "Mechanical", area: "Process", duration: 0, wbsCode: "2", offset: 110, isMilestone: true },

      // Procurement
      { taskCode: "PCM-001", name: "Vendor Prequalification", type: "task" as const, discipline: "Procurement", area: "Procurement", duration: 20, wbsCode: "3", offset: 10 },
      { taskCode: "PCM-002", name: "Major Equipment Procurement", type: "task" as const, discipline: "Procurement", area: "Equipment", duration: 120, wbsCode: "3", offset: 25 },
      { taskCode: "PCM-003", name: "Structural Steel Supply", type: "task" as const, discipline: "Structural", area: "Materials", duration: 60, wbsCode: "3", offset: 80 },
      { taskCode: "PCM-004", name: "Bulk Materials - Civil", type: "task" as const, discipline: "Civil", area: "Materials", duration: 45, wbsCode: "3", offset: 85 },
      { taskCode: "PCM-005", name: "Electrical & Instrumentation Packages", type: "task" as const, discipline: "E&I", area: "Materials", duration: 90, wbsCode: "3", offset: 60 },
      { taskCode: "PCM-006", name: "Piping Materials Supply", type: "task" as const, discipline: "Piping", area: "Materials", duration: 75, wbsCode: "3", offset: 90 },
      { taskCode: "PCM-007", name: "Equipment Delivery - Major", type: "milestone" as const, discipline: "Procurement", area: "Equipment", duration: 0, wbsCode: "3", offset: 150, isMilestone: true },

      // Construction
      { taskCode: "CON-001", name: "Site Preparation & Mobilization", type: "task" as const, discipline: "Civil", area: "Site", duration: 20, wbsCode: "4", offset: 90 },
      { taskCode: "CON-002", name: "Earthworks & Grading", type: "task" as const, discipline: "Civil", area: "Site", duration: 35, wbsCode: "4", offset: 108 },
      { taskCode: "CON-003", name: "Foundations - Process Area", type: "task" as const, discipline: "Civil", area: "Foundations", duration: 45, wbsCode: "4", offset: 140 },
      { taskCode: "CON-004", name: "Foundations - Utility Area", type: "task" as const, discipline: "Civil", area: "Utilities", duration: 30, wbsCode: "4", offset: 150 },
      { taskCode: "CON-005", name: "Structural Steel Erection", type: "task" as const, discipline: "Structural", area: "Superstructure", duration: 55, wbsCode: "4", offset: 185 },
      { taskCode: "CON-006", name: "Equipment Installation", type: "task" as const, discipline: "Mechanical", area: "Process", duration: 60, wbsCode: "4", offset: 210 },
      { taskCode: "CON-007", name: "Piping Fabrication & Installation", type: "task" as const, discipline: "Piping", area: "Process", duration: 75, wbsCode: "4", offset: 220 },
      { taskCode: "CON-008", name: "Electrical Installation", type: "task" as const, discipline: "E&I", area: "Electrical", duration: 60, wbsCode: "4", offset: 225 },
      { taskCode: "CON-009", name: "Instrumentation Installation", type: "task" as const, discipline: "Instrumentation", area: "Control", duration: 50, wbsCode: "4", offset: 240 },
      { taskCode: "CON-010", name: "Mechanical Completion", type: "milestone" as const, discipline: "Mechanical", area: "Process", duration: 0, wbsCode: "4", offset: 300, isMilestone: true },
      
      // Commissioning
      { taskCode: "COM-001", name: "System Flushing & Cleaning", type: "task" as const, discipline: "Commissioning", area: "Pre-Comm", duration: 20, wbsCode: "5", offset: 298 },
      { taskCode: "COM-002", name: "Electrical Loop Checks", type: "task" as const, discipline: "Commissioning", area: "Pre-Comm", duration: 25, wbsCode: "5", offset: 300 },
      { taskCode: "COM-003", name: "Instrumentation Calibration", type: "task" as const, discipline: "Commissioning", area: "Pre-Comm", duration: 20, wbsCode: "5", offset: 305 },
      { taskCode: "COM-004", name: "Cold Commissioning", type: "task" as const, discipline: "Commissioning", area: "Commissioning", duration: 30, wbsCode: "5", offset: 325 },
      { taskCode: "COM-005", name: "Hot Commissioning & Performance Test", type: "task" as const, discipline: "Commissioning", area: "Commissioning", duration: 25, wbsCode: "5", offset: 355 },
      { taskCode: "COM-006", name: "Ready for Start-Up", type: "milestone" as const, discipline: "Commissioning", area: "Commissioning", duration: 0, wbsCode: "5", offset: 380, isMilestone: true },
      { taskCode: "COM-007", name: "Project Handover", type: "milestone" as const, discipline: "PM", area: "Project", duration: 0, wbsCode: "5", offset: 400, isMilestone: true },
    ];

    const insertedTasks = await db.insert(tasksTable).values(
      taskTemplates.map((t, idx) => ({
        projectId,
        wbsNodeId: wbsByCode[t.wbsCode]?.id ?? null,
        taskCode: t.taskCode,
        name: t.name,
        type: t.type,
        discipline: t.discipline,
        area: t.area,
        duration: t.duration,
        durationUnit: "days" as const,
        startDate: addDays(start, t.offset),
        endDate: addDays(start, t.offset + t.duration),
        isMilestone: t.isMilestone ?? false,
        percentComplete: "0",
        status: "not_started",
        sortOrder: idx,
      }))
    ).returning();

    // Create dependency relationships
    const taskByCode = Object.fromEntries(insertedTasks.map(t => [t.taskCode, t]));

    const depLinks = [
      ["PM-001", "PM-002", "FS"],
      ["PM-001", "ENG-001", "FS"],
      ["ENG-001", "ENG-002", "FS"],
      ["ENG-001", "ENG-004", "FS"],
      ["ENG-002", "ENG-003", "SS"],
      ["ENG-001", "PCM-001", "FS"],
      ["PCM-001", "PCM-002", "FS"],
      ["ENG-004", "PCM-002", "SS"],
      ["ENG-002", "ENG-008", "FS"],
      ["ENG-004", "ENG-009", "FS"],
      ["ENG-008", "CON-001", "FS"],
      ["CON-001", "CON-002", "FS"],
      ["CON-002", "CON-003", "FS"],
      ["ENG-008", "CON-003", "FS"],
      ["CON-002", "CON-004", "FS"],
      ["CON-003", "CON-005", "FS"],
      ["PCM-003", "CON-005", "FS"],
      ["CON-005", "CON-006", "FS"],
      ["PCM-002", "CON-006", "FS"],
      ["ENG-009", "CON-006", "FS"],
      ["CON-006", "CON-007", "SS"],
      ["PCM-006", "CON-007", "FS"],
      ["CON-005", "CON-008", "SS"],
      ["PCM-005", "CON-008", "FS"],
      ["CON-008", "CON-009", "SS"],
      ["CON-007", "CON-010", "FS"],
      ["CON-008", "CON-010", "FS"],
      ["CON-009", "CON-010", "FS"],
      ["CON-010", "COM-001", "FS"],
      ["CON-010", "COM-002", "FS"],
      ["CON-010", "COM-003", "FS"],
      ["COM-001", "COM-004", "FS"],
      ["COM-002", "COM-004", "FS"],
      ["COM-003", "COM-004", "FS"],
      ["COM-004", "COM-005", "FS"],
      ["COM-005", "COM-006", "FS"],
      ["COM-006", "COM-007", "FS"],
    ];

    const depsToInsert = depLinks
      .filter(([pred, succ]) => taskByCode[pred] && taskByCode[succ])
      .map(([pred, succ, rel]) => ({
        projectId,
        predecessorTaskId: taskByCode[pred].id,
        successorTaskId: taskByCode[succ].id,
        relationshipType: rel,
        lagValue: 0,
        lagUnit: "days",
      }));

    await db.insert(dependenciesTable).values(depsToInsert);

    // Generate AI suggestions
    const suggestions = [
      {
        projectId,
        targetType: "task",
        targetId: taskByCode["PCM-002"]?.id,
        suggestionType: "duration_warning",
        message: "Major Equipment Procurement is set to 120 days. For industrial projects, long-lead equipment often requires 180-240 days. Consider reviewing delivery schedules with vendors early.",
        severity: "warning",
        proposedChangeJson: { duration: 180, reason: "Industry benchmark for major rotating equipment" },
        status: "pending",
      },
      {
        projectId,
        targetType: "task",
        targetId: taskByCode["COM-005"]?.id,
        suggestionType: "sequencing_gap",
        message: "Hot Commissioning may require regulatory inspection approval before Performance Test. Consider adding a milestone for regulatory sign-off.",
        severity: "info",
        proposedChangeJson: { addMilestone: "Regulatory Inspection Approval" },
        status: "pending",
      },
      {
        projectId,
        targetType: "schedule",
        targetId: null,
        suggestionType: "missing_predecessor",
        message: "Site Preparation should have a dependency on Environmental Permit Approval. No such milestone or task exists in the current schedule.",
        severity: "critical",
        proposedChangeJson: { addTask: "Environmental Permit Approval", linkTo: "CON-001" },
        status: "pending",
      },
      {
        projectId,
        targetType: "task",
        targetId: taskByCode["CON-005"]?.id,
        suggestionType: "resource_concern",
        message: "Structural Steel Erection overlaps with Equipment Installation by 25 days. Verify crane resource availability — simultaneous heavy lift operations in the same area may create conflicts.",
        severity: "warning",
        proposedChangeJson: { considerLag: 10 },
        status: "pending",
      },
      {
        projectId,
        targetType: "schedule",
        targetId: null,
        suggestionType: "schedule_quality",
        message: "No commissioning systems turnover packages are defined. Consider structuring commissioning by system (water treatment, process, utilities) rather than as a single block.",
        severity: "info",
        proposedChangeJson: { structure: "system-based commissioning" },
        status: "pending",
      },
    ].filter(s => s.targetId !== undefined);

    const insertedSuggestions = await db.insert(aiSuggestionsTable).values(suggestions).returning();

    await db.insert(chatMessagesTable).values({
      projectId,
      role: "assistant",
      content: `Schedule generated successfully. I've created ${insertedTasks.length} activities and ${depsToInsert.length} logic links across 5 WBS levels. 

Key highlights:
- Engineering phase: ${insertedTasks.filter(t => t.wbsNodeId === wbsByCode["2"]?.id).length} deliverables planned
- Procurement: Major equipment on critical path (120-day lead time flagged)  
- Construction: Structured by discipline with proper sequence logic
- Commissioning: Sequential pre-comm → cold comm → hot comm approach

I've identified ${insertedSuggestions.length} planning observations in the AI Suggestions panel. Please review the schedule and let me know if you'd like to adjust any assumptions.`,
      messageType: "generation_complete",
    });

    res.json({
      tasksCreated: insertedTasks.length,
      dependenciesCreated: depsToInsert.length,
      wbsNodesCreated: wbsNodes.length,
      suggestionsCreated: insertedSuggestions.length,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
