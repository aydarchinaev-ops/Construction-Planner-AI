import { Router } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import wbsRouter from "./wbs";
import { projectTasksRouter, taskRouter } from "./tasks";
import { projectDepsRouter, depRouter } from "./dependencies";
import chatRouter from "./chat";
import { projectSuggestionsRouter, suggestionRouter } from "./suggestions";
import validationRouter from "./validation";
import templatesRouter from "./templates";
import exportRouter from "./export";
import versionsRouter from "./versions";

const router = Router();

router.use(healthRouter);
router.use("/projects", projectsRouter);
router.use("/projects/:projectId/wbs", wbsRouter);
router.use("/projects/:projectId/tasks", projectTasksRouter);
router.use("/tasks", taskRouter);
router.use("/projects/:projectId/dependencies", projectDepsRouter);
router.use("/dependencies", depRouter);
router.use("/projects/:projectId/chat", chatRouter);
router.use("/projects/:projectId/ai-suggestions", projectSuggestionsRouter);
router.use("/ai-suggestions", suggestionRouter);
router.use("/projects/:projectId/validation", validationRouter);
router.use("/templates", templatesRouter);
router.use("/projects/:projectId/export", exportRouter);
router.use("/projects/:projectId/versions", versionsRouter);

export default router;
