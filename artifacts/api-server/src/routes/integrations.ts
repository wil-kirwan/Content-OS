import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, integrationsTable, plannerItemsTable, activityLogTable, socialAccountsTable } from "@workspace/db";
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

// Platform name normalisation for display
const PLATFORM_DISPLAY: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  instagram_story: "Instagram Stories",
  tiktok: "TikTok",
  youtube: "YouTube",
  youtube_shorts: "YouTube Shorts",
  linkedin: "LinkedIn",
  twitter: "Twitter / X",
  x: "Twitter / X",
  gmb: "Google My Business",
  google_my_business: "Google My Business",
  podcast: "Podcast",
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

interface HLAccount {
  _id?: string;
  id?: string;
  accountId?: string;
  name?: string;
  displayName?: string;
  type?: string;
  platform?: string;
  username?: string;
  avatar?: string;
  picture?: string;
  profilePicture?: string;
  accountType?: string;
  status?: string;
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

// Fetch and parse HighLevel social accounts for a location
async function fetchHLAccounts(token: string, locationId: string): Promise<{ accountId: string; platform: string; name: string; username?: string; avatar?: string; accountType?: string }[]> {
  const url = `https://services.leadconnectorhq.com/social-media-posting/${locationId}/accounts`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Version: "2021-07-28",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HighLevel Accounts API returned ${response.status}: ${await response.text()}`);
  }

  const data = await response.json() as {
    success?: boolean;
    results?: Record<string, HLAccount[]> | HLAccount[] | { accounts?: HLAccount[] };
    accounts?: HLAccount[];
    data?: HLAccount[];
  };

  const accounts: { accountId: string; platform: string; name: string; username?: string; avatar?: string; accountType?: string }[] = [];

  // Results can be an object keyed by platform (e.g. { facebook: [...], instagram: [...] })
  // OR a flat array, OR { accounts: [...] }
  const results = data.results ?? data.accounts ?? data.data;

  if (results && !Array.isArray(results) && typeof results === "object" && !("accounts" in results)) {
    // Keyed by platform
    for (const [platform, platformAccounts] of Object.entries(results as Record<string, HLAccount[]>)) {
      if (!Array.isArray(platformAccounts)) continue;
      for (const acct of platformAccounts) {
        const id = acct._id || acct.id || acct.accountId;
        if (!id) continue;
        accounts.push({
          accountId: id,
          platform: platform.toLowerCase(),
          name: acct.name || acct.displayName || platform,
          username: acct.username,
          avatar: acct.avatar || acct.picture || acct.profilePicture,
          accountType: acct.accountType || acct.type,
        });
      }
    }
  } else if (Array.isArray(results)) {
    for (const acct of results as HLAccount[]) {
      const id = acct._id || acct.id || acct.accountId;
      if (!id) continue;
      accounts.push({
        accountId: id,
        platform: (acct.platform || acct.type || "unknown").toLowerCase(),
        name: acct.name || acct.displayName || "Account",
        username: acct.username,
        avatar: acct.avatar || acct.picture || acct.profilePicture,
        accountType: acct.accountType || acct.type,
      });
    }
  } else if (results && typeof results === "object" && "accounts" in results) {
    const inner = (results as { accounts?: HLAccount[] }).accounts ?? [];
    for (const acct of inner) {
      const id = acct._id || acct.id || acct.accountId;
      if (!id) continue;
      accounts.push({
        accountId: id,
        platform: (acct.platform || acct.type || "unknown").toLowerCase(),
        name: acct.name || acct.displayName || "Account",
        username: acct.username,
        avatar: acct.avatar || acct.picture || acct.profilePicture,
        accountType: acct.accountType || acct.type,
      });
    }
  }

  return accounts;
}

function getMonthDateRange(fromDate?: string, toDate?: string): { from: string; to: string } {
  if (fromDate && toDate) return { from: fromDate, to: toDate };
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

async function fetchAllHLPosts(token: string, locationId: string, accountIds: string[], fromDate: string, toDate: string): Promise<HLPost[]> {
  const allPosts: HLPost[] = [];
  const limit = 50;
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const url = `https://services.leadconnectorhq.com/social-media-posting/${locationId}/posts/list`;
    const body: Record<string, string> = {
      type: "all",
      limit: String(limit),
      skip: String(skip),
      fromDate,
      toDate,
    };
    if (accountIds.length > 0) {
      body.accounts = accountIds.join(", ");
    }
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Version: "2021-07-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HighLevel API returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json() as { posts?: HLPost[]; data?: HLPost[]; count?: number; total?: number; meta?: { total?: number } };
    const posts: HLPost[] = data.posts || data.data || [];
    allPosts.push(...posts);

    const total = data.meta?.total || data.count || data.total || 0;
    skip += limit;
    hasMore = posts.length === limit && (total === 0 || skip < total);
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

// GET social accounts stored for an integration
router.get("/workspaces/:workspaceId/integrations/:id/accounts", async (req, res): Promise<void> => {
  const workspaceId = parseInt(req.params.workspaceId, 10);
  const integrationId = parseInt(req.params.id, 10);
  if (isNaN(workspaceId) || isNaN(integrationId)) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const accounts = await db.select().from(socialAccountsTable)
    .where(and(
      eq(socialAccountsTable.workspaceId, workspaceId),
      eq(socialAccountsTable.integrationId, integrationId),
    ));
  res.json(accounts.map(formatAccount));
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
  let accountsSynced = 0;
  const errors: string[] = [];
  const platformBreakdown: Record<string, number> = {};

  const { fromDate: reqFromDate, toDate: reqToDate } = req.body as { fromDate?: string; toDate?: string };
  const dateRange = getMonthDateRange(reqFromDate, reqToDate);

  if (integration.encryptedToken && integration.locationId && integration.status === "connected") {
    try {
      // Step 1: Fetch and store social accounts from HighLevel
      let accountIds: string[] = [];
      try {
        const hlAccounts = await fetchHLAccounts(integration.encryptedToken, integration.locationId);

        // Upsert each account into the DB
        for (const acct of hlAccounts) {
          const existing = await db.select().from(socialAccountsTable)
            .where(and(
              eq(socialAccountsTable.integrationId, integration.id),
              eq(socialAccountsTable.accountId, acct.accountId),
            ))
            .limit(1);

          if (existing.length > 0) {
            await db.update(socialAccountsTable).set({
              name: acct.name,
              username: acct.username ?? existing[0].username,
              avatar: acct.avatar ?? existing[0].avatar,
              accountType: acct.accountType ?? existing[0].accountType,
              platform: acct.platform,
              status: "active",
              lastSyncedAt: new Date(),
              updatedAt: new Date(),
            }).where(eq(socialAccountsTable.id, existing[0].id));
          } else {
            await db.insert(socialAccountsTable).values({
              workspaceId: params.data.workspaceId,
              integrationId: integration.id,
              accountId: acct.accountId,
              platform: acct.platform,
              name: acct.name,
              username: acct.username,
              avatar: acct.avatar,
              accountType: acct.accountType,
              status: "active",
              lastSyncedAt: new Date(),
            });
          }
          accountIds.push(acct.accountId);
          accountsSynced++;
        }
      } catch (acctErr) {
        // Accounts fetch failed — fall back to existing stored accounts
        const stored = await db.select().from(socialAccountsTable)
          .where(and(
            eq(socialAccountsTable.workspaceId, params.data.workspaceId),
            eq(socialAccountsTable.integrationId, integration.id),
          ));
        accountIds = stored.map((a) => a.accountId);
        errors.push(`Accounts fetch warning: ${acctErr instanceof Error ? acctErr.message : String(acctErr)}`);
      }

      // Step 2: Fetch all social posts from HighLevel (using accountIds and date range)
      const hlPosts = await fetchAllHLPosts(integration.encryptedToken, integration.locationId, accountIds, dateRange.from, dateRange.to);

      // Step 3: Expand each post into one record per platform
      type PostPlatformPair = { post: HLPost; platform: string; laneName: string };
      const pairs: PostPlatformPair[] = [];

      for (const post of hlPosts) {
        const platforms = extractPlatforms(post);
        if (platforms.length === 0) continue;
        for (const platform of platforms) {
          const laneName = HL_PLATFORM_TO_LANE[platform];
          if (laneName) {
            pairs.push({ post, platform, laneName });
          }
        }
      }

      // Step 4: Find which external IDs already exist in the DB
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

      // Step 5: Upsert each pair
      for (const { post, platform, laneName } of pairs) {
        const externalId = `${post._id}::${platform}`;
        const content = extractContent(post);
        const plannedDate = extractScheduledDate(post);
        const plannerStatus = HL_STATUS_TO_PLANNER[post.status ?? ""] || "planned";
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

      // Step 6: Log the sync
      if (itemsCreated + itemsUpdated > 0 || accountsSynced > 0) {
        await db.insert(activityLogTable).values({
          workspaceId: params.data.workspaceId,
          action: "synced_from_highlevel",
          entityType: "social_posts",
          entityId: 0,
          entityTitle: `HighLevel Social Sync — ${accountsSynced} accounts, ${itemsCreated} new posts, ${itemsUpdated} updated`,
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
  const postErrors = errors.filter((e) => !e.startsWith("Accounts fetch warning"));
  res.json({
    success: postErrors.length === 0,
    accountsSynced,
    itemsCreated,
    itemsUpdated,
    itemsSynced: totalSynced,
    itemsFailed,
    platformBreakdown,
    message: postErrors.length === 0
      ? totalSynced > 0
        ? `Synced ${totalSynced} social posts (${itemsCreated} new, ${itemsUpdated} updated) across ${accountsSynced} accounts`
        : accountsSynced > 0
          ? `Found ${accountsSynced} connected social accounts — no posts returned`
          : "No accounts or posts found in HighLevel Social Planner"
      : postErrors[0],
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

function formatAccount(a: typeof socialAccountsTable.$inferSelect) {
  return {
    id: a.id,
    workspaceId: a.workspaceId,
    integrationId: a.integrationId,
    accountId: a.accountId,
    platform: a.platform,
    name: a.name,
    username: a.username ?? null,
    avatar: a.avatar ?? null,
    accountType: a.accountType ?? null,
    status: a.status,
    lastSyncedAt: a.lastSyncedAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export default router;
