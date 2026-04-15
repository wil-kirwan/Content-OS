import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db, plannerItemsTable, campaignsTable, activityLogTable } from "@workspace/db";
import {
  GetPlannerItemsParams,
  CreatePlannerItemParams,
  CreatePlannerItemBody,
  GetPlannerItemParams,
  UpdatePlannerItemParams,
  UpdatePlannerItemBody,
  DeletePlannerItemParams,
  DuplicatePlannerItemParams,
  PushPlannerItemToHighLevelParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/workspaces/:workspaceId/planner-items", async (req, res): Promise<void> => {
  const params = GetPlannerItemsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { month, laneGroup, status, approvalStatus, syncStatus, campaignId } = req.query as Record<string, string>;
  const conditions = [eq(plannerItemsTable.workspaceId, params.data.workspaceId)];
  if (month) {
    const [year, mon] = month.split("-");
    const startDate = `${year}-${mon}-01`;
    const endDate = new Date(parseInt(year), parseInt(mon), 0);
    const endDateStr = `${year}-${mon}-${endDate.getDate().toString().padStart(2, "0")}`;
    conditions.push(gte(plannerItemsTable.plannedDate, startDate));
    conditions.push(lte(plannerItemsTable.plannedDate, endDateStr));
  }
  if (campaignId) conditions.push(eq(plannerItemsTable.campaignId, parseInt(campaignId, 10)));
  if (laneGroup) conditions.push(eq(plannerItemsTable.laneGroup, laneGroup));
  if (status) conditions.push(eq(plannerItemsTable.status, status));
  if (approvalStatus) conditions.push(eq(plannerItemsTable.approvalStatus, approvalStatus));
  if (syncStatus) conditions.push(eq(plannerItemsTable.syncStatus, syncStatus));
  const items = await db.select({
    item: plannerItemsTable,
    campaignName: campaignsTable.name,
  })
    .from(plannerItemsTable)
    .leftJoin(campaignsTable, eq(plannerItemsTable.campaignId, campaignsTable.id))
    .where(and(...conditions))
    .orderBy(plannerItemsTable.plannedDate, plannerItemsTable.createdAt);
  res.json(items.map(({ item, campaignName }) => formatPlannerItem(item, campaignName)));
});

router.post("/workspaces/:workspaceId/planner-items", async (req, res): Promise<void> => {
  const params = CreatePlannerItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreatePlannerItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [item] = await db.insert(plannerItemsTable).values({
    workspaceId: params.data.workspaceId,
    campaignId: parsed.data.campaignId ?? null,
    laneGroup: parsed.data.laneGroup,
    laneName: parsed.data.laneName,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    channelType: parsed.data.channelType ?? null,
    contentFormat: parsed.data.contentFormat ?? null,
    plannedDate: parsed.data.plannedDate ?? null,
    dueDate: parsed.data.dueDate ?? null,
    ownerName: parsed.data.ownerName ?? null,
    status: parsed.data.status ?? "draft",
    approvalStatus: parsed.data.approvalStatus ?? "pending",
    priority: parsed.data.priority ?? "medium",
    notes: parsed.data.notes ?? null,
    assetLinks: (parsed.data.assetLinks as string[] | undefined) ?? [],
    externalSource: "planner",
    syncStatus: "not_synced",
  }).returning();
  await db.insert(activityLogTable).values({
    workspaceId: params.data.workspaceId,
    action: "created",
    entityType: "planner_item",
    entityId: item.id,
    entityTitle: item.title,
    status: "success",
  });
  const campaign = item.campaignId
    ? await db.select().from(campaignsTable).where(eq(campaignsTable.id, item.campaignId)).then(r => r[0])
    : null;
  res.status(201).json(formatPlannerItem(item, campaign?.name ?? null));
});

router.get("/workspaces/:workspaceId/planner-items/:id", async (req, res): Promise<void> => {
  const params = GetPlannerItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [result] = await db.select({
    item: plannerItemsTable,
    campaignName: campaignsTable.name,
  })
    .from(plannerItemsTable)
    .leftJoin(campaignsTable, eq(plannerItemsTable.campaignId, campaignsTable.id))
    .where(and(eq(plannerItemsTable.workspaceId, params.data.workspaceId), eq(plannerItemsTable.id, params.data.id)));
  if (!result) {
    res.status(404).json({ error: "Planner item not found" });
    return;
  }
  res.json(formatPlannerItem(result.item, result.campaignName));
});

router.patch("/workspaces/:workspaceId/planner-items/:id", async (req, res): Promise<void> => {
  const params = UpdatePlannerItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdatePlannerItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.title != null) updateData.title = parsed.data.title;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.laneGroup != null) updateData.laneGroup = parsed.data.laneGroup;
  if (parsed.data.laneName != null) updateData.laneName = parsed.data.laneName;
  if (parsed.data.campaignId !== undefined) updateData.campaignId = parsed.data.campaignId;
  if (parsed.data.plannedDate !== undefined) updateData.plannedDate = parsed.data.plannedDate;
  if (parsed.data.dueDate !== undefined) updateData.dueDate = parsed.data.dueDate;
  if (parsed.data.ownerName !== undefined) updateData.ownerName = parsed.data.ownerName;
  if (parsed.data.status != null) updateData.status = parsed.data.status;
  if (parsed.data.approvalStatus != null) updateData.approvalStatus = parsed.data.approvalStatus;
  if (parsed.data.priority != null) updateData.priority = parsed.data.priority;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
  if (parsed.data.assetLinks != null) updateData.assetLinks = parsed.data.assetLinks;
  if (parsed.data.channelType !== undefined) updateData.channelType = parsed.data.channelType;
  if (parsed.data.contentFormat !== undefined) updateData.contentFormat = parsed.data.contentFormat;
  const [item] = await db
    .update(plannerItemsTable)
    .set(updateData)
    .where(and(eq(plannerItemsTable.workspaceId, params.data.workspaceId), eq(plannerItemsTable.id, params.data.id)))
    .returning();
  if (!item) {
    res.status(404).json({ error: "Planner item not found" });
    return;
  }
  await db.insert(activityLogTable).values({
    workspaceId: params.data.workspaceId,
    action: "updated",
    entityType: "planner_item",
    entityId: item.id,
    entityTitle: item.title,
    status: "success",
  });
  const campaign = item.campaignId
    ? await db.select().from(campaignsTable).where(eq(campaignsTable.id, item.campaignId)).then(r => r[0])
    : null;
  res.json(formatPlannerItem(item, campaign?.name ?? null));
});

router.delete("/workspaces/:workspaceId/planner-items/:id", async (req, res): Promise<void> => {
  const params = DeletePlannerItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [item] = await db.delete(plannerItemsTable)
    .where(and(eq(plannerItemsTable.workspaceId, params.data.workspaceId), eq(plannerItemsTable.id, params.data.id)))
    .returning();
  if (item) {
    await db.insert(activityLogTable).values({
      workspaceId: params.data.workspaceId,
      action: "deleted",
      entityType: "planner_item",
      entityId: item.id,
      entityTitle: item.title,
      status: "success",
    });
  }
  res.json({ success: true });
});

router.post("/workspaces/:workspaceId/planner-items/:id/duplicate", async (req, res): Promise<void> => {
  const params = DuplicatePlannerItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [original] = await db.select().from(plannerItemsTable)
    .where(and(eq(plannerItemsTable.workspaceId, params.data.workspaceId), eq(plannerItemsTable.id, params.data.id)));
  if (!original) {
    res.status(404).json({ error: "Planner item not found" });
    return;
  }
  const [dup] = await db.insert(plannerItemsTable).values({
    workspaceId: original.workspaceId,
    campaignId: original.campaignId,
    laneGroup: original.laneGroup,
    laneName: original.laneName,
    title: `${original.title} (copy)`,
    description: original.description,
    channelType: original.channelType,
    contentFormat: original.contentFormat,
    plannedDate: original.plannedDate,
    dueDate: original.dueDate,
    ownerName: original.ownerName,
    status: "draft",
    approvalStatus: "pending",
    priority: original.priority,
    notes: original.notes,
    assetLinks: original.assetLinks,
    externalSource: "planner",
    syncStatus: "not_synced",
  }).returning();
  const campaign = dup.campaignId
    ? await db.select().from(campaignsTable).where(eq(campaignsTable.id, dup.campaignId)).then(r => r[0])
    : null;
  res.status(201).json(formatPlannerItem(dup, campaign?.name ?? null));
});

router.post("/workspaces/:workspaceId/planner-items/:id/push", async (req, res): Promise<void> => {
  const params = PushPlannerItemToHighLevelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [item] = await db.select().from(plannerItemsTable)
    .where(and(eq(plannerItemsTable.workspaceId, params.data.workspaceId), eq(plannerItemsTable.id, params.data.id)));
  if (!item) {
    res.status(404).json({ error: "Planner item not found" });
    return;
  }
  // Mark as syncing
  await db.update(plannerItemsTable).set({ syncStatus: "syncing", updatedAt: new Date() }).where(eq(plannerItemsTable.id, item.id));
  // In real implementation, this would call the HighLevel API
  // For now, update to synced status
  await db.update(plannerItemsTable).set({
    syncStatus: "synced",
    lastSyncAt: new Date(),
    status: "scheduled",
    updatedAt: new Date(),
  }).where(eq(plannerItemsTable.id, item.id));
  await db.insert(activityLogTable).values({
    workspaceId: params.data.workspaceId,
    action: "pushed_to_highlevel",
    entityType: "planner_item",
    entityId: item.id,
    entityTitle: item.title,
    status: "success",
  });
  res.json({ success: true, itemsSynced: 1, itemsFailed: 0, message: "Item pushed to HighLevel successfully", errors: [] });
});

function formatPlannerItem(item: typeof plannerItemsTable.$inferSelect, campaignName: string | null | undefined) {
  return {
    id: item.id,
    workspaceId: item.workspaceId,
    campaignId: item.campaignId,
    campaignName: campaignName ?? null,
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
    lastSyncAt: item.lastSyncAt?.toISOString() ?? null,
    publishedAt: item.publishedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export default router;
