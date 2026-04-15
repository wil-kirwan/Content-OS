import { Router, type IRouter } from "express";
import healthRouter from "./health";
import workspacesRouter from "./workspaces";
import integrationsRouter from "./integrations";
import campaignsRouter from "./campaigns";
import plannerItemsRouter from "./planner-items";
import templatesRouter from "./templates";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(workspacesRouter);
router.use(integrationsRouter);
router.use(campaignsRouter);
router.use(plannerItemsRouter);
router.use(templatesRouter);
router.use(dashboardRouter);

export default router;
