import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

// ─── Standard Webhooks signature verification ────────────────────────────────
//
// Polar signs webhooks with the Standard Webhooks scheme:
//   signed content = `${webhook-id}.${webhook-timestamp}.${rawBody}`
//   signature      = base64( HMAC-SHA256(signed content, secretBytes) )
//   secretBytes    = base64Decode(secret without the optional "whsec_" prefix)
//   webhook-signature header = space-delimited list of `v1,<base64sig>`
//
// Implemented with Web Crypto so it runs in the Convex runtime (no Node deps).

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** Constant-time string comparison. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyPolarSignature(
  secret: string,
  id: string,
  timestamp: string,
  signatureHeader: string,
  body: string,
): Promise<boolean> {
  const secretBytes = base64ToBytes(secret.replace(/^whsec_/, ""));
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = `${id}.${timestamp}.${body}`;
  const msgBytes = new TextEncoder().encode(signed);
  const sigBuf = await crypto.subtle.sign("HMAC", key, msgBytes.buffer as ArrayBuffer);
  const expected = bytesToBase64(new Uint8Array(sigBuf));

  // The header may carry several signatures, each "v1,<sig>".
  return signatureHeader.split(" ").some((part) => {
    const comma = part.indexOf(",");
    const sig = comma >= 0 ? part.slice(comma + 1) : part;
    return safeEqual(sig, expected);
  });
}

// ─── /polar/events ───────────────────────────────────────────────────────────

const polarWebhook = httpAction(async (ctx, request) => {
  const body = await request.text();
  const id = request.headers.get("webhook-id");
  const timestamp = request.headers.get("webhook-timestamp");
  const signature = request.headers.get("webhook-signature");
  const secret = process.env.POLAR_WEBHOOK_SECRET;

  if (!secret) return new Response("Webhook secret not configured", { status: 500 });
  if (!id || !timestamp || !signature) {
    return new Response("Missing signature headers", { status: 400 });
  }

  const valid = await verifyPolarSignature(secret, id, timestamp, signature, body);
  if (!valid) return new Response("Invalid signature", { status: 401 });

  let event: { type?: string; data?: unknown };
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!event.type) return new Response("Missing event type", { status: 400 });

  await ctx.runMutation(internal.billing.applyPolarEvent, {
    type: event.type,
    data: event.data ?? {},
  });

  return new Response(null, { status: 202 });
});

const http = httpRouter();
http.route({ path: "/polar/events", method: "POST", handler: polarWebhook });

export default http;
