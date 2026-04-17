import { pgTable, serial, varchar, text, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";

export const webhookEventsTable = pgTable("webhook_events", {
  id: serial("id").primaryKey(),
  webhookId: varchar("webhook_id", { length: 255 }).unique(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  locationId: varchar("location_id", { length: 255 }),
  payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
  signatureVerified: boolean("signature_verified").notNull().default(false),
  processed: boolean("processed").notNull().default(false),
  processingError: text("processing_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});
