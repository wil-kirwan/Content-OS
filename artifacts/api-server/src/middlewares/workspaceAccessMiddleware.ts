import { type Request, type Response, type NextFunction } from "express";
import { db, workspaceMembersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const ADMIN_EMAIL = "wil.kirwan@gmail.com";

export async function workspaceAccessMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const workspaceId = parseInt(req.params.workspaceId, 10);
  if (isNaN(workspaceId)) {
    res.status(400).json({ error: "Invalid workspaceId" });
    return;
  }

  if (req.user.email === ADMIN_EMAIL) {
    next();
    return;
  }

  const [membership] = await db
    .select()
    .from(workspaceMembersTable)
    .where(
      and(
        eq(workspaceMembersTable.userId, req.user.id),
        eq(workspaceMembersTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!membership) {
    res.status(403).json({ error: "Access denied to this workspace" });
    return;
  }

  next();
}
