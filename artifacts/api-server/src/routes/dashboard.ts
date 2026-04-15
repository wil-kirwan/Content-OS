import { Router, type IRouter } from "express";
import { eq, and, gte, lte, lt, sql, desc } from "drizzle-orm";
import { db, plannerItemsTable, campaignsTable, integrationsTable, activityLogTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/workspaces/:workspaceId/dashboard/summary", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.workspaceId) ? req.params.workspaceId[0] : req.params.workspaceId;
  const workspaceId = parseInt(rawId, 10);
  if (isNaN(workspaceId)) {
    res.status(400).json({ error: "Invalid workspaceId" });
    return;
  }
  const month = req.query.month as string | undefined;
  const conditions = [eq(plannerItemsTable.workspaceId, workspaceId)];
  if (month) {
    const [year, mon] = month.split("-");
    const startDate = `${year}-${mon}-01`;
    const endDate = new Date(parseInt(year), parseInt(mon), 0);
    const endDateStr = `${year}-${mon}-${endDate.getDate().toString().padStart(2, "0")}`;
    conditions.push(gte(plannerItemsTable.plannedDate, startDate));
    conditions.push(lte(plannerItemsTable.plannedDate, endDateStr));
  }
  const items = await db.select({ status: plannerItemsTable.status, syncStatus: plannerItemsTable.syncStatus, dueDate: plannerItemsTable.dueDate })
    .from(plannerItemsTable).where(and(...conditions));
  const now = new Date().toISOString().split("T")[0];
  const totalPlanned = items.length;
  const totalPublished = items.filter(i => i.status === "published").length;
  const totalDraft = items.filter(i => i.status === "draft").length;
  const totalScheduled = items.filter(i => i.status === "scheduled").length;
  const totalFailed = items.filter(i => i.status === "failed").length;
  const totalOverdue = items.filter(i => i.dueDate && i.dueDate < now && i.status !== "published" && i.status !== "archived").length;
  const syncedCount = items.filter(i => i.syncStatus === "synced").length;
  const completionRate = totalPlanned > 0 ? Math.round((totalPublished / totalPlanned) * 100) / 100 : 0;
  const [{ activeCampaigns }] = await db.select({ activeCampaigns: sql<number>`cast(count(*) as int)` })
    .from(campaignsTable).where(and(eq(campaignsTable.workspaceId, workspaceId), eq(campaignsTable.status, "active")));
  const [{ connectedIntegrations }] = await db.select({ connectedIntegrations: sql<number>`cast(count(*) as int)` })
    .from(integrationsTable).where(and(eq(integrationsTable.workspaceId, workspaceId), eq(integrationsTable.status, "connected")));
  res.json({
    totalPlanned,
    totalPublished,
    totalDraft,
    totalScheduled,
    totalFailed,
    totalOverdue,
    syncedCount,
    completionRate,
    activeCampaigns: activeCampaigns ?? 0,
    connectedIntegrations: connectedIntegrations ?? 0,
  });
});

router.get("/workspaces/:workspaceId/dashboard/channel-breakdown", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.workspaceId) ? req.params.workspaceId[0] : req.params.workspaceId;
  const workspaceId = parseInt(rawId, 10);
  if (isNaN(workspaceId)) {
    res.status(400).json({ error: "Invalid workspaceId" });
    return;
  }
  const month = req.query.month as string | undefined;
  const conditions = [eq(plannerItemsTable.workspaceId, workspaceId)];
  if (month) {
    const [year, mon] = month.split("-");
    const startDate = `${year}-${mon}-01`;
    const endDate = new Date(parseInt(year), parseInt(mon), 0);
    const endDateStr = `${year}-${mon}-${endDate.getDate().toString().padStart(2, "0")}`;
    conditions.push(gte(plannerItemsTable.plannedDate, startDate));
    conditions.push(lte(plannerItemsTable.plannedDate, endDateStr));
  }
  const items = await db.select({
    laneGroup: plannerItemsTable.laneGroup,
    laneName: plannerItemsTable.laneName,
    status: plannerItemsTable.status,
  }).from(plannerItemsTable).where(and(...conditions));
  const grouped = new Map<string, { laneGroup: string; laneName: string; total: number; published: number; planned: number; draft: number; failed: number }>();
  for (const item of items) {
    const key = `${item.laneGroup}::${item.laneName}`;
    if (!grouped.has(key)) {
      grouped.set(key, { laneGroup: item.laneGroup, laneName: item.laneName, total: 0, published: 0, planned: 0, draft: 0, failed: 0 });
    }
    const entry = grouped.get(key)!;
    entry.total++;
    if (item.status === "published") entry.published++;
    else if (item.status === "planned" || item.status === "scheduled") entry.planned++;
    else if (item.status === "draft") entry.draft++;
    else if (item.status === "failed") entry.failed++;
  }
  res.json(Array.from(grouped.values()));
});

router.get("/workspaces/:workspaceId/dashboard/recent-activity", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.workspaceId) ? req.params.workspaceId[0] : req.params.workspaceId;
  const workspaceId = parseInt(rawId, 10);
  if (isNaN(workspaceId)) {
    res.status(400).json({ error: "Invalid workspaceId" });
    return;
  }
  const limit = parseInt((req.query.limit as string) ?? "20", 10);
  const activities = await db.select().from(activityLogTable)
    .where(eq(activityLogTable.workspaceId, workspaceId))
    .orderBy(desc(activityLogTable.createdAt))
    .limit(limit);
  res.json(activities.map(a => ({
    id: a.id,
    workspaceId: a.workspaceId,
    action: a.action,
    entityType: a.entityType,
    entityId: a.entityId,
    entityTitle: a.entityTitle,
    details: a.details,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
  })));
});

router.get("/workspaces/:workspaceId/dashboard/overdue", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.workspaceId) ? req.params.workspaceId[0] : req.params.workspaceId;
  const workspaceId = parseInt(rawId, 10);
  if (isNaN(workspaceId)) {
    res.status(400).json({ error: "Invalid workspaceId" });
    return;
  }
  const now = new Date().toISOString().split("T")[0];
  const items = await db.select().from(plannerItemsTable)
    .where(and(
      eq(plannerItemsTable.workspaceId, workspaceId),
      lt(plannerItemsTable.dueDate, now),
    ))
    .orderBy(plannerItemsTable.dueDate);
  const filtered = items.filter(i => i.status !== "published" && i.status !== "archived");
  res.json(filtered.map(item => ({
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
    lastSyncAt: item.lastSyncAt?.toISOString() ?? null,
    publishedAt: item.publishedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  })));
});

export default router;
