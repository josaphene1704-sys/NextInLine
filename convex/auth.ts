import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";

/**
 * Phone OTP verification.
 *
 * Production: Twilio Verify (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and
 * TWILIO_VERIFY_SERVICE_SID in the Convex environment) — Twilio generates,
 * delivers and checks the code itself.
 *
 * Local/dev fallback (env vars absent): the server generates a random 4-digit
 * code, stores it in the `otpCodes` table with a short TTL, and prints it to
 * the Convex server log so it can be read during testing. Verification is
 * always server-side — the code never reaches the client.
 */

const OTP_TTL_MS = 5 * 60 * 1000; // dev-fallback codes expire after 5 minutes
const OTP_MAX_ATTEMPTS = 5;       // wrong guesses allowed before the code dies

/** Cryptographically random 4-digit code ("0000"–"9999", unbiased). */
function generateOtpCode(): string {
  const limit = 4_294_960_000; // largest multiple of 10,000 that fits in uint32
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return String(buf[0] % 10_000).padStart(4, "0");
}

/**
 * Normalise a user-entered phone to E.164, which Twilio Verify requires.
 * Defaults local (Israeli) numbers to +972: "050-123-4567" → "+972501234567".
 * A number already in international form (leading +) is kept, digits only.
 */
function toE164(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/\D/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("972")) return "+" + digits;
  if (digits.startsWith("0")) return "+972" + digits.slice(1);
  return "+" + digits;
}

/** Twilio Verify credentials, or null when not configured (local dev). */
function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!accountSid || !authToken || !serviceSid) return null;
  return { accountSid, authToken, serviceSid };
}

async function twilioVerifyPost(
  cfg: { accountSid: string; authToken: string; serviceSid: string },
  endpoint: "Verifications" | "VerificationCheck",
  params: Record<string, string>
): Promise<Response> {
  return await fetch(
    `https://verify.twilio.com/v2/Services/${cfg.serviceSid}/${endpoint}`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${cfg.accountSid}:${cfg.authToken}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString(),
    }
  );
}

// ─── sendOtp ─────────────────────────────────────────────────────────────────

export const sendOtp = action({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    if (!phone.trim()) throw new ConvexError("נא להזין מספר טלפון");
    const to = toE164(phone);

    const twilio = getTwilioConfig();
    if (twilio) {
      const res = await twilioVerifyPost(twilio, "Verifications", {
        To: to,
        Channel: "sms",
      });
      if (!res.ok) {
        console.error("Twilio Verify send failed:", res.status, await res.text());
        throw new ConvexError("שליחת קוד האימות נכשלה, נסי שוב");
      }
      return { sent: true };
    }

    // Dev fallback — no SMS provider configured.
    const code = generateOtpCode();
    await ctx.runMutation(internal.auth.storeOtp, { phone: to, code });
    console.log(`📱 [OTP] קוד אימות עבור ${to}: ${code}`);
    return { sent: true };
  },
});

// ─── verifyOtp ───────────────────────────────────────────────────────────────

export const verifyOtp = action({
  args: { phone: v.string(), code: v.string() },
  // Explicit return type breaks the TS circularity from internal.auth below.
  handler: async (ctx, { phone, code }): Promise<{ verified: boolean }> => {
    const to = toE164(phone);
    const submitted = code.trim();
    if (!/^\d{4}$/.test(submitted)) return { verified: false };

    const twilio = getTwilioConfig();
    if (twilio) {
      const res = await twilioVerifyPost(twilio, "VerificationCheck", {
        To: to,
        Code: submitted,
      });
      if (!res.ok) {
        // 404 = verification not found / already expired — a normal miss.
        if (res.status === 404) return { verified: false };
        console.error("Twilio Verify check failed:", res.status, await res.text());
        throw new ConvexError("אימות הקוד נכשל, נסי שוב");
      }
      const data = await res.json();
      return { verified: data.status === "approved" };
    }

    const verified: boolean = await ctx.runMutation(internal.auth.consumeOtp, {
      phone: to,
      code: submitted,
    });
    return { verified };
  },
});

// ─── Dev-fallback code storage (internal) ────────────────────────────────────

export const storeOtp = internalMutation({
  args: { phone: v.string(), code: v.string() },
  handler: async (ctx, { phone, code }) => {
    // One live code per phone — a resend invalidates the previous code.
    const existing = await ctx.db
      .query("otpCodes")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .take(10);
    for (const row of existing) await ctx.db.delete(row._id);

    await ctx.db.insert("otpCodes", {
      phone,
      code,
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
    });
  },
});

export const consumeOtp = internalMutation({
  args: { phone: v.string(), code: v.string() },
  handler: async (ctx, { phone, code }) => {
    const row = await ctx.db
      .query("otpCodes")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .unique(); // storeOtp guarantees at most one row per phone

    if (!row) return false;

    if (row.expiresAt < Date.now() || row.attempts >= OTP_MAX_ATTEMPTS) {
      await ctx.db.delete(row._id);
      return false;
    }

    if (row.code !== code) {
      await ctx.db.patch(row._id, { attempts: row.attempts + 1 });
      return false;
    }

    await ctx.db.delete(row._id); // single-use
    return true;
  },
});
