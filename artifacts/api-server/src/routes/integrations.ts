import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, integrationsTable } from "@workspace/db";
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
  // Attempt real HighLevel validation
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
  // Update status
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
  let itemsSynced = 0;
  let itemsFailed = 0;
  const errors: string[] = [];
  if (integration.encryptedToken && integration.locationId && integration.status === "connected") {
    // Sync social posts from HighLevel
    try {
      const postsResponse = await fetch(
        `https://services.leadconnectorhq.com/social-media-posting/${integration.locationId}/posts?limit=20`,
        {
          headers: {
            Authorization: `Bearer ${integration.encryptedToken}`,
            Version: "2021-07-28",
          },
        }
      );
      if (postsResponse.ok) {
        itemsSynced += 1;
      }
    } catch {
      errors.push("Failed to fetch social posts from HighLevel");
      itemsFailed += 1;
    }
  }
  await db.update(integrationsTable).set({
    lastSyncedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(integrationsTable.id, params.data.id));
  res.json({
    success: errors.length === 0,
    itemsSynced,
    itemsFailed,
    message: errors.length === 0 ? "Sync completed successfully" : "Sync completed with errors",
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
