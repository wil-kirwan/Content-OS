import crypto from "crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { db, webhookEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const GHL_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=
-----END PUBLIC KEY-----`;

const LEGACY_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAokvo/r9tVgcfZ5DysOSC
Frm602qYV0MaAiNnX9O8KxMbiyRKWeL9JpCpVpt4XHIcBOK4u3cLSqJGOLaPuXw6
dO0t6Q/ZVdAV5Phz+ZtzPL16iCGeK9po6D6JHBpbi989mmzMryUnQJezlYJ3DVfB
csedpinheNnyYeFXolrJvcsjDtfAeRx5ByHQmTnSdFUzuAnC9/GepgLT9SM4nCpv
uxmZMxrJt5Rw+VUaQ9B8JSvbMPpez4peKaJPZHBbU3OdeCVx5klVXXZQGNHOs8gF
3kvoV5rTnXV0IknLBXlcKKAQLZcY/Q9rG6Ifi9c+5vqlvHPCUJFT5XUGG5RKgOKU
J062fRtN+rLYZUV+BjafxQauvC8wSWeYja63VSUruvmNj8xkx2zE/Juc+yjLjTXp
IocmaiFeAO6fUtNjDeFVkhf5LNb59vECyrHD2SQIrhgXpO4Q3dVNA5rw576PwTzN
h/AMfHKIjE4xQA1SZuYJmNnmVZLIZBlQAF9Ntd03rfadZ+yDiOXCCs9FkHibELhC
HULgCsnuDJHcrGNd5/Ddm5hxGQ0ASitgHeMZ0kcIOwKDOzOU53lDza6/Y09T7sYJ
PQe7z0cvj7aE4B+Ax1ZoZGPzpJlZtGXCsu9aTEGEnKzmsFqwcSsnw3JB31IGKAyk
T1hhTiaCeIY/OwwwNUY2yvcCAwEAAQ==
-----END PUBLIC KEY-----`;

function verifyGhl(payload: string, signature: string): boolean {
  try {
    const payloadBuffer = Buffer.from(payload, "utf8");
    const signatureBuffer = Buffer.from(signature, "base64");
    return crypto.verify(null, payloadBuffer, GHL_PUBLIC_KEY, signatureBuffer);
  } catch {
    return false;
  }
}

function verifyLegacy(payload: string, signature: string): boolean {
  try {
    const verifier = crypto.createVerify("SHA256");
    verifier.update(payload);
    return verifier.verify(LEGACY_PUBLIC_KEY, signature, "base64");
  } catch {
    return false;
  }
}

function verifySignature(rawBody: string, headers: Record<string, string | string[] | undefined>): boolean {
  const ghlSig = headers["x-ghl-signature"];
  const legacySig = headers["x-wh-signature"];

  if (ghlSig && typeof ghlSig === "string" && ghlSig !== "N/A") {
    return verifyGhl(rawBody, ghlSig);
  }
  if (legacySig && typeof legacySig === "string" && legacySig !== "N/A") {
    return verifyLegacy(rawBody, legacySig);
  }
  return false;
}

async function processWebhookAsync(webhookId: string, eventType: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const locationId = (payload.locationId as string) ??
      (payload.data as Record<string, unknown>)?.locationId as string ?? null;

    await db.update(webhookEventsTable)
      .set({ processed: true, processedAt: new Date(), locationId: locationId || null })
      .where(eq(webhookEventsTable.webhookId, webhookId));

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.update(webhookEventsTable)
      .set({ processed: false, processingError: msg })
      .where(eq(webhookEventsTable.webhookId, webhookId))
      .catch(() => undefined);
  }
}

router.post("/webhooks", async (req: Request, res: Response): Promise<void> => {
  try {
    const rawBody = JSON.stringify(req.body);
    const signatureVerified = verifySignature(rawBody, req.headers as Record<string, string | undefined>);

    const body = req.body as Record<string, unknown>;
    const webhookId = (body.webhookId as string) ?? null;
    const eventType = (body.type as string) ?? "unknown";

    if (webhookId) {
      const [existing] = await db.select({ id: webhookEventsTable.id })
        .from(webhookEventsTable)
        .where(eq(webhookEventsTable.webhookId, webhookId))
        .limit(1);

      if (existing) {
        res.status(200).json({ success: true, message: "Already processed" });
        return;
      }
    }

    await db.insert(webhookEventsTable).values({
      webhookId: webhookId || undefined,
      eventType,
      payload: body,
      signatureVerified,
      processed: false,
    });

    setImmediate(() => {
      if (webhookId) {
        processWebhookAsync(webhookId, eventType, body).catch(() => undefined);
      }
    });

    res.status(200).json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log?.error({ err }, "Webhook handler error");
    res.status(200).json({ success: false, error: msg });
  }
});

export default router;
