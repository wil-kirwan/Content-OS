import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, integrationsTable, plannerItemsTable, activityLogTable } from "@workspace/db";
import {
  GetIntegrationsParams,
  CreateIntegrationParams,
  CreateIntegrationBody,
  GetIntegrationParams,
  UpdateIntegrationParams,
  UpdateIntegrationBody,
  DeleteIntegrationParams,
  ValidateIntegrationParams,
  SyncIntegrationParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// HighLevel Social Planner platform → Planner lane name
const HL_PLATFORM_TO_LANE: Record<string, string> = {
  facebook: "Facebook Post",
  instagram: "Instagram Post",
  instagram_story: "Instagram Stories",
  ig_story: "Instagram Stories",
  story: "Instagram Stories",
  tiktok: "TikTok",
  youtube: "YouTube Shorts",
  youtube_shorts: "YouTube Shorts",
  linkedin: "LinkedIn",
  twitter: "Twitter / X",
  x: "Twitter / X",
  gmb: "Google My Business",
  google_my_business: "Google My Business",
  podcast: "Podcast",
};

// HighLevel post status → planner item status
const HL_STATUS_TO_PLANNER: Record<string, string> = {
  SCHEDULED: "scheduled",
  scheduled: "scheduled",
  PUBLISHED: "published",
  published: "published",
  FAILED: "failed",
  failed: "failed",
  DRAFT: "draft",
  draft: "draft",
  PENDING: "planned",
  pending: "planned",
};

interface HLPost {
  _id: string;
  status?: string;
  content?: string;
  body?: string;
  summary?: string;
  type?: string;
  postType?: string;
  platform?: string;
  channels?: string[];
  platforms?: string[];
  scheduleTime?: string;
  scheduledAt?: string;
  publishedAt?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

function extractPlatforms(post: HLPost): string[] {
  if (post.platform) return [post.platform.toLowerCase()];
  if (post.channels && post.channels.length > 0) return post.channels.map((c) => c.toLowerCase());
  if (post.platforms && post.platforms.length > 0) return post.platforms.map((c) => c.toLowerCase());
  return [];
}

function extractContent(post: HLPost): string {
  return (post.content || post.body || post.summary || "").trim();
}

function extractScheduledDate(post: HLPost): string | null {
  const dateStr = post.scheduleTime || post.scheduledAt;
  if (!dateStr) return null;
  return dateStr.split("T")[0];
}

async function fetchAllHLPosts(token: string, locationId: string): Promise<HLPost[]> {
  const allPosts: HLPost[] = [];
  const limit = 50;
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const url = `https://services.leadconnectorhq.com/social-media-posting/oauth/${locationId}/posts?limit=${limit}&skip=${skip}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Version: "2021-07-28",
      },
    });

    if (!response.ok) {
      throw new Error(`HighLevel API returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json() as { posts?: HLPost[]; data?: HLPost[]; count?: number; total?: number };
    const posts: HLPost[] = data.posts || data.data || [];
    allPosts.push(...posts);

    const total = data.count || data.total || 0;
    skip += limit;
    hasMore = posts.length === limit && skip < total;
  }

  return allPosts;
}

router.get("/workspaces/:workspaceId/integrations", async (req, res): Promise<void> => {
  const params = GetIntegrationsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const integrations = await db.select().from(integrationsTable)
    .where(eq(integrationsTable.workspaceId, params.data.workspaceId));
  res.json(integrations.map(formatIntegration));
});

router.post("/workspaces/:workspaceId/integrations", async (req, res): Promise<void> => {
  const params = CreateIntegrationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateIntegrationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tokenLastFour = parsed.data.token.slice(-4);
  const rotationDue = new Date();
  rotationDue.setDate(rotationDue.getDate() + 90);
  const [integration] = await db.insert(integrationsTable).values({
    workspaceId: params.data.workspaceId,
    provider: parsed.data.provider,
    authType: parsed.data.authType,
    encryptedToken: parsed.data.token,
    locationId: parsed.data.locationId,
    tokenLastFour,
    scopes: parsed.data.scopes ?? null,
    status: "connected",
    lastValidatedAt: new Date(),
    tokenRotationDueAt: rotationDue,
  }).returning();
  res.status(201).json(formatIntegration(integration));
});

router.get("/workspaces/:workspaceId/integrations/:id", async (req, res): Promise<void> => {
  const params = GetIntegrationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [integration] = await db.select().from(integrationsTable)
    .where(and(eq(integrationsTable.workspaceId, params.data.workspaceId), eq(integrationsTable.id, params.data.id)));
  if (!integration) {
    res.status(404).json({ error: "Integration not found" });
    return;
  }
  res.json(formatIntegration(integration));
});

router.patch("/workspaces/:workspaceId/integrations/:id", async (req, res): Promise<void> => {
  const params = UpdateIntegrationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateIntegrationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.token) {
    updateData.encryptedToken = parsed.data.token;
    updateData.tokenLastFour = parsed.data.token.slice(-4);
    const rotationDue = new Date();
    rotationDue.setDate(rotationDue.getDate() + 90);
    updateData.tokenRotationDueAt = rotationDue;
    updateData.status = "connected";
    updateData.lastValidatedAt = new Date();
  }
  if (parsed.data.locationId != null) updateData.locationId = parsed.data.locationId;
  if (parsed.data.scopes != null) updateData.scopes = parsed.data.scopes;
  const [integration] = await db
    .update(integrationsTable)
    .set(updateData)
    .where(and(eq(integrationsTable.workspaceId, params.data.workspaceId), eq(integrationsTable.id, params.data.id)))
    .returning();
  if (!integration) {
    res.status(404).json({ error: "Integration not found" });
    return;
  }
  res.json(formatIntegration(integration));
});

router.delete("/workspaces/:workspaceId/integrations/:id", async (req, res): Promise<void> => {
  const params = DeleteIntegrationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(integrationsTable)
    .where(and(eq(integrationsTable.workspaceId, params.data.workspaceId), eq(integrationsTable.id, params.data.id)));
  res.json({ success: true });
});

router.post("/workspaces/:workspaceId/integrations/:id/validate", async (req, res): Promise<void> => {
  const params = ValidateIntegrationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [integration] = await db.select().from(integrationsTable)
    .where(and(eq(integrationsTable.workspaceId, params.data.workspaceId), eq(integrationsTable.id, params.data.id)));
  if (!integration) {
    res.status(404).json({ error: "Integration not found" });
    return;
  }
  let valid = false;
  let status = "token_invalid";
  let message = "Connection validation failed";
  const scopes: string[] = [];
  if (integration.encryptedToken && integration.locationId) {
    try {
      const response = await fetch(`https://services.leadconnectorhq.com/locations/${integration.locationId}`, {
        headers: {
          Authorization: `Bearer ${integration.encryptedToken}`,
          Version: "2021-07-28",
        },
      });
      if (response.ok) {
        valid = true;
        status = "connected";
        message = "Connection is healthy";
      } else if (response.status === 401) {
        status = "token_invalid";
        message = "Token is invalid or expired";
      } else if (response.status === 403) {
        status = "missing_scope";
        message = "Token is missing required scopes";
      } else {
        message = `HighLevel returned status ${response.status}`;
      }
    } catch {
      message = "Could not reach HighLevel API";
    }
  } else {
    message = "Token or Location ID is missing";
  }
  await db.update(integrationsTable).set({
    status,
    lastValidatedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(integrationsTable.id, params.data.id));
  res.json({ valid, status, message, scopes });
});

router.post("/workspaces/:workspaceId/integrations/:id/sync", async (req, res): Promise<void> => {
  const params = SyncIntegrationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [integration] = await db.select().from(integrationsTable)
    .where(and(eq(integrationsTable.workspaceId, params.data.workspaceId), eq(integrationsTable.id, params.data.id)));
  if (!integration) {
    res.status(404).json({ error: "Integration not found" });
    return;
  }

  let itemsCreated = 0;
  let itemsUpdated = 0;
  let itemsFailed = 0;
  const errors: string[] = [];
  const platformBreakdown: Record<string, number> = {};

  if (integration.encryptedToken && integration.locationId && integration.status === "connected") {
    try {
      // 1. Fetch all social posts from HighLevel
      const hlPosts = await fetchAllHLPosts(integration.encryptedToken, integration.locationId);

      // 2. Expand each post into one record per platform
      type PostPlatformPair = { post: HLPost; platform: string; laneName: string };
      const pairs: PostPlatformPair[] = [];

      for (const post of hlPosts) {
        const platforms = extractPlatforms(post);
        if (platforms.length === 0) {
          // No platform data — skip silently
          continue;
        }
        for (const platform of platforms) {
          const laneName = HL_PLATFORM_TO_LANE[platform];
          if (laneName) {
            pairs.push({ post, platform, laneName });
          }
        }
      }

      // 3. Find which external IDs already exist in the DB
      const externalIds = pairs.map(({ post, platform }) => `${post._id}::${platform}`);

      const existingItems = externalIds.length > 0
        ? await db.select().from(plannerItemsTable).where(
            and(
              eq(plannerItemsTable.workspaceId, params.data.workspaceId),
              eq(plannerItemsTable.externalSource, "highlevel"),
              inArray(plannerItemsTable.externalObjectId, externalIds)
            )
          )
        : [];

      const existingMap = new Map(existingItems.map((i) => [i.externalObjectId, i]));

      // 4. Upsert each pair
      for (const { post, platform, laneName } of pairs) {
        const externalId = `${post._id}::${platform}`;
        const content = extractContent(post);
        const plannedDate = extractScheduledDate(post);
        const plannerStatus = HL_STATUS_TO_PLANNER[post.status ?? ""] || "planned";
        // Title = first 100 chars of content, or fallback
        const title = content.slice(0, 100) || `${laneName} post`;

        try {
          const existing = existingMap.get(externalId);
          if (existing) {
            await db.update(plannerItemsTable).set({
              title,
              description: content || null,
              laneName,
              status: plannerStatus,
              syncStatus: "synced",
              plannedDate: plannedDate ?? existing.plannedDate,
              lastSyncAt: new Date(),
              updatedAt: new Date(),
            }).where(eq(plannerItemsTable.id, existing.id));
            itemsUpdated++;
          } else {
            await db.insert(plannerItemsTable).values({
              workspaceId: params.data.workspaceId,
              laneGroup: "social",
              laneName,
              title,
              description: content || null,
              plannedDate,
              status: plannerStatus,
              approvalStatus: "pending",
              priority: "medium",
              assetLinks: [],
              externalSource: "highlevel",
              externalObjectType: "social_post",
              externalObjectId: externalId,
              syncStatus: "synced",
              lastSyncAt: new Date(),
            });
            itemsCreated++;
          }
          platformBreakdown[laneName] = (platformBreakdown[laneName] || 0) + 1;
        } catch (err) {
          itemsFailed++;
          errors.push(`Failed to sync post ${post._id} (${platform}): ${String(err)}`);
        }
      }

      // 5. Log the sync
      if (itemsCreated + itemsUpdated > 0) {
        await db.insert(activityLogTable).values({
          workspaceId: params.data.workspaceId,
          action: "synced_from_highlevel",
          entityType: "social_posts",
          entityId: 0,
          entityTitle: `HighLevel Social Sync — ${itemsCreated} new, ${itemsUpdated} updated`,
          status: errors.length === 0 ? "success" : "warning",
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Sync failed: ${message}`);
      itemsFailed++;
    }
  } else {
    errors.push("Integration is not connected or missing credentials");
  }

  await db.update(integrationsTable).set({
    lastSyncedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(integrationsTable.id, params.data.id));

  const totalSynced = itemsCreated + itemsUpdated;
  res.json({
    success: errors.length === 0,
    itemsCreated,
    itemsUpdated,
    itemsSynced: totalSynced,
    itemsFailed,
    platformBreakdown,
    message: errors.length === 0
      ? totalSynced > 0
        ? `Synced ${totalSynced} social posts (${itemsCreated} new, ${itemsUpdated} updated)`
        : "No posts found in HighLevel Social Planner"
      : errors[0],
    errors,
  });
});

function formatIntegration(i: typeof integrationsTable.$inferSelect) {
  return {
    id: i.id,
    workspaceId: i.workspaceId,
    provider: i.provider,
    authType: i.authType,
    locationId: i.locationId,
    tokenLastFour: i.tokenLastFour,
    scopes: i.scopes,
    status: i.status,
    lastValidatedAt: i.lastValidatedAt?.toISOString() ?? null,
    lastSyncedAt: i.lastSyncedAt?.toISOString() ?? null,
    tokenRotationDueAt: i.tokenRotationDueAt?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  };
}

export default router;
