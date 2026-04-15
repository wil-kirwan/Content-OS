import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, workspacesTable } from "@workspace/db";
import {
  CreateWorkspaceBody,
  UpdateWorkspaceBody,
  GetWorkspaceParams,
  UpdateWorkspaceParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/workspaces", async (_req, res): Promise<void> => {
  const workspaces = await db.select().from(workspacesTable).orderBy(workspacesTable.createdAt);
  res.json(workspaces.map(formatWorkspace));
});

router.post("/workspaces", async (req, res): Promise<void> => {
  const parsed = CreateWorkspaceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [workspace] = await db.insert(workspacesTable).values(parsed.data).returning();
  res.status(201).json(formatWorkspace(workspace));
});

router.get("/workspaces/:id", async (req, res): Promise<void> => {
  const params = GetWorkspaceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [workspace] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, params.data.id));
  if (!workspace) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }
  res.json(formatWorkspace(workspace));
});

router.patch("/workspaces/:id", async (req, res): Promise<void> => {
  const params = UpdateWorkspaceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateWorkspaceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [workspace] = await db
    .update(workspacesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(workspacesTable.id, params.data.id))
    .returning();
  if (!workspace) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }
  res.json(formatWorkspace(workspace));
});

function formatWorkspace(w: typeof workspacesTable.$inferSelect) {
  return {
    id: w.id,
    name: w.name,
    slug: w.slug,
    description: w.description,
    logoUrl: w.logoUrl,
    industry: w.industry,
    timezone: w.timezone,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

export default router;
