import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, templatesTable, plannerItemsTable } from "@workspace/db";
import {
  GetTemplatesParams,
  CreateTemplateParams,
  CreateTemplateBody,
  GetTemplateParams,
  DeleteTemplateParams,
  ApplyTemplateBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/workspaces/:workspaceId/templates", async (req, res): Promise<void> => {
  const params = GetTemplatesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const templates = await db.select().from(templatesTable)
    .where(eq(templatesTable.workspaceId, params.data.workspaceId))
    .orderBy(templatesTable.createdAt);
  res.json(templates.map(formatTemplate));
});

router.post("/workspaces/:workspaceId/templates", async (req, res): Promise<void> => {
  const params = CreateTemplateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [template] = await db.insert(templatesTable).values({
    workspaceId: params.data.workspaceId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    category: parsed.data.category,
    items: parsed.data.items,
  }).returning();
  res.status(201).json(formatTemplate(template));
});

router.get("/workspaces/:workspaceId/templates/:id", async (req, res): Promise<void> => {
  const params = GetTemplateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [template] = await db.select().from(templatesTable)
    .where(and(eq(templatesTable.workspaceId, params.data.workspaceId), eq(templatesTable.id, params.data.id)));
  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.json(formatTemplate(template));
});

router.delete("/workspaces/:workspaceId/templates/:id", async (req, res): Promise<void> => {
  const params = DeleteTemplateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(templatesTable)
    .where(and(eq(templatesTable.workspaceId, params.data.workspaceId), eq(templatesTable.id, params.data.id)));
  res.json({ success: true });
});

router.post("/workspaces/:workspaceId/templates/:id/apply", async (req, res): Promise<void> => {
  const rawWorkspaceId = Array.isArray(req.params.workspaceId) ? req.params.workspaceId[0] : req.params.workspaceId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const workspaceId = parseInt(rawWorkspaceId, 10);
  const id = parseInt(rawId, 10);
  if (isNaN(workspaceId) || isNaN(id)) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const parsed = ApplyTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [template] = await db.select().from(templatesTable)
    .where(and(eq(templatesTable.workspaceId, workspaceId), eq(templatesTable.id, id)));
  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  const items = template.items as Array<{
    laneGroup: string;
    laneName: string;
    title: string;
    description?: string;
    dayOffset: number;
    channelType?: string;
    contentFormat?: string;
    priority: string;
  }>;
  const startDate = new Date(parsed.data.startDate);
  const createdItems = await Promise.all(items.map(async (templateItem) => {
    const plannedDate = new Date(startDate);
    plannedDate.setDate(plannedDate.getDate() + (templateItem.dayOffset ?? 0));
    const dateStr = plannedDate.toISOString().split("T")[0];
    const [item] = await db.insert(plannerItemsTable).values({
      workspaceId,
      laneGroup: templateItem.laneGroup,
      laneName: templateItem.laneName,
      title: templateItem.title,
      description: templateItem.description ?? null,
      channelType: templateItem.channelType ?? null,
      contentFormat: templateItem.contentFormat ?? null,
      plannedDate: dateStr,
      status: "draft",
      approvalStatus: "pending",
      priority: templateItem.priority ?? "medium",
      assetLinks: [],
      externalSource: "planner",
      syncStatus: "not_synced",
    }).returning();
    return {
      id: item.id,
      workspaceId: item.workspaceId,
      campaignId: item.campaignId,
      campaignName: null,
      laneGroup: item.laneGroup,
      laneName: item.laneName,
      title: item.title,
      description: item.description,
      channelType: item.channelType,
      contentFormat: item.contentFormat,
      plannedDate: item.plannedDate,
      dueDate: item.dueDate,
      ownerName: item.ownerName,
      status: item.status,
      approvalStatus: item.approvalStatus,
      priority: item.priority,
      notes: item.notes,
      assetLinks: item.assetLinks ?? [],
      externalSource: item.externalSource,
      externalObjectType: item.externalObjectType,
      externalObjectId: item.externalObjectId,
      syncStatus: item.syncStatus,
      lastSyncAt: null,
      publishedAt: null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }));
  res.json(createdItems);
});

function formatTemplate(t: typeof templatesTable.$inferSelect) {
  const items = (t.items as unknown[]) ?? [];
  return {
    id: t.id,
    workspaceId: t.workspaceId,
    name: t.name,
    description: t.description,
    category: t.category,
    itemCount: items.length,
    items,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export default router;
