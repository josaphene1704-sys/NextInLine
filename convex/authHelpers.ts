/**
 * Session-token helpers for admin/boss authorization.
 * DB-dependent (unlike helpers.ts), so kept in its own file.
 */

import { MutationCtx, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Generates a fresh opaque session token. */
export function generateSessionToken(): string {
  return crypto.randomUUID();
}

/** Creates and persists a new session row, returns the token. */
export async function issueSession(
  ctx: MutationCtx,
  role: "admin" | "boss",
  businessId?: Id<"businesses">
): Promise<string> {
  const token = generateSessionToken();
  const now = Date.now();
  await ctx.db.insert("sessions", {
    token,
    role,
    businessId,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });
  return token;
}

/**
 * Looks up a session by token, verifies it hasn't expired, and asserts it
 * belongs to the given business (a "boss" session may act on any business).
 * Throws on any failure.
 */
export async function requireBusinessSession(
  ctx: QueryCtx | MutationCtx,
  token: string | undefined,
  businessId: Id<"businesses">
): Promise<void> {
  if (!token) throw new Error("Unauthorized: missing session token");

  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();

  if (!session) throw new Error("Unauthorized: invalid session");
  if (session.expiresAt < Date.now()) throw new Error("Unauthorized: session expired");
  if (session.role === "boss") return;
  if (session.businessId !== businessId) {
    throw new Error("Unauthorized: session does not match business");
  }
}

/** Verifies a boss/master session token. Throws on any failure. */
export async function requireBossSession(
  ctx: QueryCtx | MutationCtx,
  token: string | undefined
): Promise<void> {
  if (!token) throw new Error("Unauthorized: missing session token");

  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();

  if (!session) throw new Error("Unauthorized: invalid session");
  if (session.expiresAt < Date.now()) throw new Error("Unauthorized: session expired");
  if (session.role !== "boss") throw new Error("Unauthorized: requires boss role");
}

/** Deletes all sessions belonging to a business — call on password rotation. */
export async function invalidateBusinessSessions(
  ctx: MutationCtx,
  businessId: Id<"businesses">
): Promise<void> {
  const sessions = await ctx.db
    .query("sessions")
    .withIndex("by_business", (q) => q.eq("businessId", businessId))
    .collect();
  await Promise.all(sessions.map((s) => ctx.db.delete(s._id)));
}
