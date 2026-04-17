import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, webhookEventsTable } from "@workspace/db";
import { desc, count } from "drizzle-orm";

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

export default router;
