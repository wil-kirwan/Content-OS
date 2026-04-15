import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { integrationsTable } from "./integrations";

export const socialAccountsTable = pgTable("social_accounts", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  integrationId: integer("integration_id").notNull().references(() => integrationsTable.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  platform: text("platform").notNull(),
  name: text("name").notNull(),
  username: text("username"),
  avatar: text("avatar"),
  accountType: text("account_type"),
  status: text("status").notNull().default("active"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SocialAccount = typeof socialAccountsTable.$inferSelect;
