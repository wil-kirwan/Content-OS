import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, webhookEventsTable, workspaceMembersTable, workspacesTable } from "@workspace/db";
import { desc, count, eq, and } from "drizzle-orm";

const router: IRouter = Router();

const ADMIN_EMAIL = "wil.kirwan@gmail.com";

function requireAdmin(req: Request, res: Response): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }
  if (req.user.email !== ADMIN_EMAIL) {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

router.get("/admin/users", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const users = await db
    .select()
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt));

  res.json(users.map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    profileImageUrl: u.profileImageUrl,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  })));
});

router.get("/admin/webhook-events", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = 50;
  const offset = (page - 1) * limit;

  const [events, [{ total }]] = await Promise.all([
    db.select().from(webhookEventsTable)
      .orderBy(desc(webhookEventsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(webhookEventsTable),
  ]);

  res.json({
    events: events.map((e) => ({
      id: e.id,
      webhookId: e.webhookId,
      eventType: e.eventType,
      locationId: e.locationId,
      signatureVerified: e.signatureVerified,
      processed: e.processed,
      processingError: e.processingError,
      createdAt: e.createdAt.toISOString(),
      processedAt: e.processedAt?.toISOString() ?? null,
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

router.get("/admin/workspace-members", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const workspaceId = req.query.workspaceId ? parseInt(String(req.query.workspaceId), 10) : undefined;

  const members = await db
    .select({
      userId: workspaceMembersTable.userId,
      workspaceId: workspaceMembersTable.workspaceId,
      role: workspaceMembersTable.role,
      createdAt: workspaceMembersTable.createdAt,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      profileImageUrl: usersTable.profileImageUrl,
    })
    .from(workspaceMembersTable)
    .innerJoin(usersTable, eq(workspaceMembersTable.userId, usersTable.id))
    .where(workspaceId ? eq(workspaceMembersTable.workspaceId, workspaceId) : undefined)
    .orderBy(workspaceMembersTable.createdAt);

  res.json(members.map((m) => ({
    userId: m.userId,
    workspaceId: m.workspaceId,
    role: m.role,
    createdAt: m.createdAt.toISOString(),
    email: m.email,
    firstName: m.firstName,
    lastName: m.lastName,
    profileImageUrl: m.profileImageUrl,
  })));
});

router.post("/admin/workspace-members", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const { userId, workspaceId, role } = req.body as { userId: string; workspaceId: number; role?: string };
  if (!userId || !workspaceId) {
    res.status(400).json({ error: "userId and workspaceId are required" });
    return;
  }

  const [member] = await db
    .insert(workspaceMembersTable)
    .values({ userId, workspaceId, role: role ?? "member" })
    .onConflictDoUpdate({
      target: [workspaceMembersTable.userId, workspaceMembersTable.workspaceId],
      set: { role: role ?? "member" },
    })
    .returning();

  res.json(member);
});

router.delete("/admin/workspace-members/:userId", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const { userId } = req.params;
  const workspaceId = parseInt(String(req.query.workspaceId), 10);
  if (!workspaceId) {
    res.status(400).json({ error: "workspaceId query param required" });
    return;
  }

  await db
    .delete(workspaceMembersTable)
    .where(and(eq(workspaceMembersTable.userId, userId), eq(workspaceMembersTable.workspaceId, workspaceId)));

  res.json({ success: true });
});

router.get("/admin/workspaces", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const workspaces = await db.select().from(workspacesTable).orderBy(workspacesTable.id);
  res.json(workspaces);
});

export default router;
