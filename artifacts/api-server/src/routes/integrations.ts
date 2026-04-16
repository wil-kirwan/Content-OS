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
  google: "Google My Business",   // HL returns "google" for GMB posts
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
  google: "Google My Business",
  podcast: "Podcast",
};

interface HLPost {
  _id: string;
  postId?: string;
  status?: string;
  // Content — HL composer stores the post body in "summary"
  summary?: string;
  content?: string;
  body?: string;
  // Platform — single string e.g. "google", "facebook", "instagram", "tiktok", "linkedin"
  platform?: string;
  channel?: string;
  channels?: string[];
  platforms?: string[];
  // Dates — HL uses "scheduleDate" in composer responses
  scheduleDate?: string;
  displayDate?: string;
  scheduledAt?: string;
  scheduleTime?: string;
  publishedAt?: string;
  // Metadata
  type?: string;
  postType?: string;
  tags?: string[];
  media?: { url: string; type: string }[];
  createdAt?: string;
  updatedAt?: string;
  postApprovalDetails?: { approvalStatus?: string };
  user?: { id?: string; firstName?: string; lastName?: string };
  // Which connected account(s) this post targets — the authoritative platform source
  accountIds?: string[];
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
  expire?: string;
  isExpired?: boolean;
  originId?: string;
}

function extractPlatforms(post: HLPost): string[] {
  if (post.platform) return [post.platform.toLowerCase()];
  if (post.channels && post.channels.length > 0) return post.channels.map((c) => c.toLowerCase());
  if (post.platforms && post.platforms.length > 0) return post.platforms.map((c) => c.toLowerCase());
  return [];
}

function extractContent(post: HLPost): string {
  // HL composer uses "summary" as the post body field
  return (post.summary || post.content || post.body || "").trim();
}

function extractScheduledDate(post: HLPost): string | null {
  // HL composer uses "scheduleDate"; fall back to other fields
  const dateStr = post.scheduleDate || post.displayDate || post.scheduledAt || post.scheduleTime;
  if (!dateStr) return null;
  return dateStr.split("T")[0];
}

// Fetch and parse HighLevel social accounts for a location
interface ParsedHLAccount {
  accountId: string;
  platform: string;
  name: string;
  username?: string;
  avatar?: string;
  accountType?: string;
  expireAt?: Date;
  isExpired?: boolean;
}

function parseHLAccount(acct: HLAccount, fallbackPlatform?: string): ParsedHLAccount | null {
  const id = acct.id || acct._id || acct.accountId;
  if (!id) return null;
  return {
    accountId: id,
    platform: (acct.platform || fallbackPlatform || "unknown").toLowerCase(),
    name: acct.name || acct.displayName || "Account",
    username: acct.username || acct.originId,
    avatar: acct.avatar || acct.picture || acct.profilePicture,
    accountType: acct.type || acct.accountType,
    expireAt: acct.expire ? new Date(acct.expire) : undefined,
    isExpired: acct.isExpired ?? false,
  };
}

async function fetchHLAccounts(token: string, locationId: string): Promise<ParsedHLAccount[]> {
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
    results?: { accounts?: HLAccount[]; groups?: unknown[] } | HLAccount[] | Record<string, HLAccount[]>;
    accounts?: HLAccount[];
    data?: HLAccount[];
  };

  const parsed: ParsedHLAccount[] = [];

  // Primary shape: { results: { accounts: [...] } }  — the actual HL API response
  const results = data.results ?? data.accounts ?? data.data;

  if (results && !Array.isArray(results) && typeof results === "object" && "accounts" in results) {
    const inner = (results as { accounts?: HLAccount[] }).accounts ?? [];
    for (const acct of inner) {
      const p = parseHLAccount(acct);
      if (p) parsed.push(p);
    }
  } else if (Array.isArray(results)) {
    for (const acct of results as HLAccount[]) {
      const p = parseHLAccount(acct);
      if (p) parsed.push(p);
    }
  } else if (results && typeof results === "object") {
    // Keyed-by-platform shape: { facebook: [...], instagram: [...] }
    for (const [platform, platformAccounts] of Object.entries(results as Record<string, HLAccount[]>)) {
      if (!Array.isArray(platformAccounts)) continue;
      for (const acct of platformAccounts) {
        const p = parseHLAccount(acct, platform);
        if (p) parsed.push(p);
      }
    }
  }

  return parsed;
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
      includeUsers: "true",
      postType: "post",
    };
    if (accountIds.length > 0) {
      // No spaces between IDs — HL requires comma-only separation
      body.accounts = accountIds.join(",");
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

    const rawData = await response.json() as {
      success?: boolean;
      results?: { posts?: HLPost[]; total?: number; count?: number };
      posts?: HLPost[];
      data?: HLPost[];
      count?: number;
      total?: number;
      meta?: { total?: number };
    };
    // Log first page response so we can inspect the real shape if debugging
    if (skip === 0) {
      console.log("[HL posts raw sample]", JSON.stringify(rawData).slice(0, 1500));
    }
    // HL wraps posts under results.posts (composer API response shape)
    const posts: HLPost[] = rawData.results?.posts || rawData.posts || rawData.data || [];
    allPosts.push(...posts);

    const total =
      rawData.results?.total ??
      rawData.results?.count ??
      rawData.meta?.total ??
      rawData.count ??
      rawData.total ??
      0;
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

// POST refresh-accounts — fetch connected accounts from HL and store them (no post sync needed)
router.post("/workspaces/:workspaceId/integrations/:id/refresh-accounts", async (req, res): Promise<void> => {
  const workspaceId = parseInt(req.params.workspaceId, 10);
  const integrationId = parseInt(req.params.id, 10);
  if (isNaN(workspaceId) || isNaN(integrationId)) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const [integration] = await db.select().from(integrationsTable)
    .where(and(eq(integrationsTable.workspaceId, workspaceId), eq(integrationsTable.id, integrationId)));

  if (!integration) {
    res.status(404).json({ error: "Integration not found" });
    return;
  }
  if (!integration.encryptedToken || !integration.locationId || integration.status !== "connected") {
    res.status(400).json({ error: "Integration is not connected or missing credentials" });
    return;
  }

  try {
    const hlAccounts = await fetchHLAccounts(integration.encryptedToken, integration.locationId);

    for (const acct of hlAccounts) {
      const existing = await db.select().from(socialAccountsTable)
        .where(and(
          eq(socialAccountsTable.integrationId, integrationId),
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
          expireAt: acct.expireAt ?? existing[0].expireAt,
          isExpired: acct.isExpired ?? existing[0].isExpired,
          status: "active",
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(socialAccountsTable.id, existing[0].id));
      } else {
        await db.insert(socialAccountsTable).values({
          workspaceId,
          integrationId,
          accountId: acct.accountId,
          platform: acct.platform,
          name: acct.name,
          username: acct.username,
          avatar: acct.avatar,
          accountType: acct.accountType,
          expireAt: acct.expireAt,
          isExpired: acct.isExpired,
          status: "active",
          lastSyncedAt: new Date(),
        });
      }
    }

    // Return the freshly stored accounts
    const stored = await db.select().from(socialAccountsTable)
      .where(and(
        eq(socialAccountsTable.workspaceId, workspaceId),
        eq(socialAccountsTable.integrationId, integrationId),
      ));
    res.json({ success: true, accounts: stored.map(formatAccount) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Failed to fetch accounts: ${msg}` });
  }
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
  const accountBreakdown: Record<string, { name: string; platform: string; count: number }> = {};

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
              expireAt: acct.expireAt ?? existing[0].expireAt,
              isExpired: acct.isExpired ?? existing[0].isExpired,
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
              expireAt: acct.expireAt,
              isExpired: acct.isExpired,
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

      // Step 2.5: Build a lookup map from stored accountId → stored account record
      // This is the authoritative source for which platform a post belongs to.
      // post.platform from HL is unreliable (it reflects the post type, not the connected account).
      const storedAccounts = await db.select().from(socialAccountsTable)
        .where(and(
          eq(socialAccountsTable.workspaceId, params.data.workspaceId),
          eq(socialAccountsTable.integrationId, integration.id),
        ));
      const accountIdMap = new Map(storedAccounts.map((a) => [a.accountId, a]));

      // Step 3: Build pairs — one planner item per (post × matched account)
      type PostPair = {
        post: HLPost;
        platform: string;
        laneName: string;
        externalId: string;
        accountName: string;
        accountKey: string; // for breakdown
      };
      const pairs: PostPair[] = [];

      for (const post of hlPosts) {
        const postAccountIds = post.accountIds ?? [];
        let handled = false;

        for (const postAccountId of postAccountIds) {
          const matchedAccount = accountIdMap.get(postAccountId);
          if (!matchedAccount) continue;

          const platform = matchedAccount.platform.toLowerCase();
          const laneName = HL_PLATFORM_TO_LANE[platform];
          if (!laneName) continue;

          // Key uses the full accountId so each account gets its own dedup slot
          const externalId = `${post._id}::${postAccountId}`;
          pairs.push({ post, platform, laneName, externalId, accountName: matchedAccount.name, accountKey: postAccountId });
          handled = true;
        }

        // Fallback: no accountIds matched a stored account — use post.platform
        if (!handled) {
          const platform = post.platform?.toLowerCase();
          if (!platform) continue;
          const laneName = HL_PLATFORM_TO_LANE[platform];
          if (!laneName) continue;
          const externalId = `${post._id}::${platform}`;
          pairs.push({ post, platform, laneName, externalId, accountName: platform, accountKey: platform });
        }
      }

      // Step 4: Load ALL existing HL planner items for this workspace, then find which ones
      // correspond to any post in this batch (by post._id prefix). Delete them so we can
      // re-insert with correct account-based attribution, removing any previously wrong-lane items.
      if (pairs.length > 0) {
        const allExistingHL = await db
          .select({ id: plannerItemsTable.id, externalObjectId: plannerItemsTable.externalObjectId })
          .from(plannerItemsTable)
          .where(and(
            eq(plannerItemsTable.workspaceId, params.data.workspaceId),
            eq(plannerItemsTable.externalSource, "highlevel"),
          ));

        const batchPostIds = new Set(hlPosts.map((p) => p._id));
        const staleIds = allExistingHL
          .filter((item) => {
            const postId = item.externalObjectId?.split("::")[0];
            return postId && batchPostIds.has(postId);
          })
          .map((item) => item.id);

        if (staleIds.length > 0) {
          await db.delete(plannerItemsTable).where(inArray(plannerItemsTable.id, staleIds));
        }
      }

      // Step 5: Insert all pairs as fresh records (no update needed since we deleted stale ones)
      for (const { post, platform, laneName, externalId, accountName, accountKey } of pairs) {
        const content = extractContent(post);
        const plannedDate = extractScheduledDate(post);
        const plannerStatus = HL_STATUS_TO_PLANNER[post.status ?? ""] || "planned";
        const title = content.slice(0, 100) || `${laneName} post`;

        try {
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
          platformBreakdown[laneName] = (platformBreakdown[laneName] || 0) + 1;
          if (!accountBreakdown[accountKey]) {
            accountBreakdown[accountKey] = { name: accountName, platform, count: 0 };
          }
          accountBreakdown[accountKey].count++;
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
    accountBreakdown,
    message: postErrors.length === 0
      ? totalSynced > 0
        ? `Synced ${totalSynced} posts across ${accountsSynced} accounts`
        : accountsSynced > 0
          ? `${accountsSynced} accounts connected — no posts found in this date range`
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
    expireAt: a.expireAt?.toISOString() ?? null,
    isExpired: a.isExpired ?? false,
    status: a.status,
    lastSyncedAt: a.lastSyncedAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export default router;
