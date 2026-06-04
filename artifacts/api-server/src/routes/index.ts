import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import webhooksRouter from "./webhooks";
import adminRouter from "./admin";
import workspacesRouter from "./workspaces";
import integrationsRouter from "./integrations";
import campaignsRouter from "./campaigns";
import plannerItemsRouter from "./planner-items";
import templatesRouter from "./templates";
import dashboardRouter from "./dashboard";
import { workspaceAccessMiddleware } from "../middlewares/workspaceAccessMiddleware";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(webhooksRouter);
router.use(adminRouter);
router.use(workspacesRouter);

// Workspace-scoped routes — all require authenticated workspace membership
router.use(/^\/workspaces\/\d+\/.+/, workspaceAccessMiddleware);
router.use(integrationsRouter);
router.use(campaignsRouter);
router.use(plannerItemsRouter);
router.use(templatesRouter);
router.use(dashboardRouter);

export default router;
