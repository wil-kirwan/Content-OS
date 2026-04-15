import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";

export const integrationsTable = pgTable("integrations", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("highlevel"),
  authType: text("auth_type").notNull().default("private_token"),
  encryptedToken: text("encrypted_token"),
  locationId: text("location_id"),
  tokenLastFour: text("token_last_four"),
  scopes: text("scopes"),
  status: text("status").notNull().default("disconnected"),
  lastValidatedAt: timestamp("last_validated_at"),
  lastSyncedAt: timestamp("last_synced_at"),
  tokenRotationDueAt: timestamp("token_rotation_due_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertIntegrationSchema = createInsertSchema(integrationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
export type Integration = typeof integrationsTable.$inferSelect;
