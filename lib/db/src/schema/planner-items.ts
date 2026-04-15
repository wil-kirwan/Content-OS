import { pgTable, text, serial, integer, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";
import { campaignsTable } from "./campaigns";

export const plannerItemsTable = pgTable("planner_items", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: integer("campaign_id").references(() => campaignsTable.id, { onDelete: "set null" }),
  laneGroup: text("lane_group").notNull(),
  laneName: text("lane_name").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  channelType: text("channel_type"),
  contentFormat: text("content_format"),
  plannedDate: date("planned_date"),
  dueDate: date("due_date"),
  ownerName: text("owner_name"),
  status: text("status").notNull().default("draft"),
  approvalStatus: text("approval_status").notNull().default("pending"),
  priority: text("priority").notNull().default("medium"),
  notes: text("notes"),
  assetLinks: text("asset_links").array().notNull().default([]),
  externalSource: text("external_source").notNull().default("planner"),
  externalObjectType: text("external_object_type"),
  externalObjectId: text("external_object_id"),
  syncStatus: text("sync_status").notNull().default("not_synced"),
  lastSyncAt: timestamp("last_sync_at"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPlannerItemSchema = createInsertSchema(plannerItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlannerItem = z.infer<typeof insertPlannerItemSchema>;
export type PlannerItem = typeof plannerItemsTable.$inferSelect;
