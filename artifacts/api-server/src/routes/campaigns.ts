import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, campaignsTable, plannerItemsTable } from "@workspace/db";
import {
  GetCampaignsParams,
  CreateCampaignParams,
  CreateCampaignBody,
  GetCampaignParams,
  UpdateCampaignParams,
  UpdateCampaignBody,
  DeleteCampaignParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/workspaces/:workspaceId/campaigns", async (req, res): Promise<void> => {
  const params = GetCampaignsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const campaigns = await db.select().from(campaignsTable)
    .where(eq(campaignsTable.workspaceId, params.data.workspaceId))
    .orderBy(campaignsTable.createdAt);
  const withCounts = await Promise.all(campaigns.map(async (campaign) => {
    const [{ count }] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(plannerItemsTable)
      .where(eq(plannerItemsTable.campaignId, campaign.id));
    return { ...formatCampaign(campaign), itemCount: count ?? 0 };
  }));
  res.json(withCounts);
});

router.post("/workspaces/:workspaceId/campaigns", async (req, res): Promise<void> => {
  const params = CreateCampaignParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateCampaignBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [campaign] = await db.insert(campaignsTable).values({
    workspaceId: params.data.workspaceId,
    ...parsed.data,
  }).returning();
  res.status(201).json({ ...formatCampaign(campaign), itemCount: 0 });
});

router.get("/workspaces/:workspaceId/campaigns/:id", async (req, res): Promise<void> => {
  const params = GetCampaignParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [campaign] = await db.select().from(campaignsTable)
    .where(and(eq(campaignsTable.workspaceId, params.data.workspaceId), eq(campaignsTable.id, params.data.id)));
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(plannerItemsTable)
    .where(eq(plannerItemsTable.campaignId, campaign.id));
  res.json({ ...formatCampaign(campaign), itemCount: count ?? 0 });
});

router.patch("/workspaces/:workspaceId/campaigns/:id", async (req, res): Promise<void> => {
  const params = UpdateCampaignParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCampaignBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [campaign] = await db
    .update(campaignsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(campaignsTable.workspaceId, params.data.workspaceId), eq(campaignsTable.id, params.data.id)))
    .returning();
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(plannerItemsTable)
    .where(eq(plannerItemsTable.campaignId, campaign.id));
  res.json({ ...formatCampaign(campaign), itemCount: count ?? 0 });
});

router.delete("/workspaces/:workspaceId/campaigns/:id", async (req, res): Promise<void> => {
  const params = DeleteCampaignParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(campaignsTable)
    .where(and(eq(campaignsTable.workspaceId, params.data.workspaceId), eq(campaignsTable.id, params.data.id)));
  res.json({ success: true });
});

function formatCampaign(c: typeof campaignsTable.$inferSelect) {
  return {
    id: c.id,
    workspaceId: c.workspaceId,
    name: c.name,
    type: c.type,
    startDate: c.startDate,
    endDate: c.endDate,
    theme: c.theme,
    objective: c.objective,
    status: c.status,
    color: c.color,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export default router;
