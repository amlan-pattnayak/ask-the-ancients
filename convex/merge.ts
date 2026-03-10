import { v } from "convex/values";
import { mutation } from "./_generated/server";

function looksLikeAnonId(value: string): boolean {
  return /^[a-f0-9-]{16,64}$/i.test(value);
}

function hexToBytes(hex: string): ArrayBuffer | null {
  if (!/^[a-f0-9]+$/i.test(hex) || hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes.buffer;
}

async function verifyMergeProof(params: {
  proof: string;
  anonId: string;
  userId: string;
}): Promise<boolean> {
  const secret = process.env.MERGE_PROOF_SECRET;
  if (!secret) throw new Error("MERGE_PROOF_SECRET is not configured");

  const [proofAnonId, proofUserId, expRaw, sigHex] = params.proof.split(".");
  if (!proofAnonId || !proofUserId || !expRaw || !sigHex) return false;
  if (proofAnonId !== params.anonId) return false;
  if (proofUserId !== params.userId) return false;

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;

  const sigBuffer = hexToBytes(sigHex);
  if (!sigBuffer) return false;

  const payload = `${proofAnonId}.${proofUserId}.${expRaw}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  return crypto.subtle.verify("HMAC", key, sigBuffer, new TextEncoder().encode(payload));
}

/**
 * Merge an anonymous principal's data into the authenticated user's account.
 * Called client-side immediately after sign-in.
 *
 * Idempotent: safe to call multiple times — if the alias already exists the
 * operation is a no-op.  Thread ownership, message ownership, bookmark
 * ownership, and today's rate-limit counter are all re-attributed to the
 * signed-in userId.
 */
export const mergeAnonToUser = mutation({
  args: {
    anonId: v.string(),
    mergeProof: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    if (!looksLikeAnonId(args.anonId)) throw new Error("Invalid anonymous principal");
    const userId = identity.subject; // Clerk userId
    const proofOk = await verifyMergeProof({
      proof: args.mergeProof,
      anonId: args.anonId,
      userId,
    });
    if (!proofOk) throw new Error("Invalid merge proof");

    // Idempotency: if this anonId has already been merged, return early.
    const existing = await ctx.db
      .query("principal_aliases")
      .withIndex("by_from", (q) => q.eq("fromPrincipalId", args.anonId))
      .first();
    if (existing) return { merged: 0, alreadyDone: true };

    // ── Re-attribute threads (and their messages) ────────────────────────────
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_principal", (q) =>
        q.eq("principalType", "anon").eq("principalId", args.anonId)
      )
      .collect();

    let merged = 0;
    for (const thread of threads) {
      await ctx.db.patch(thread._id, {
        principalType: "user",
        principalId: userId,
        userId,
      });

      const msgs = await ctx.db
        .query("messages")
        .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
        .collect();
      for (const msg of msgs) {
        await ctx.db.patch(msg._id, {
          principalType: "user",
          principalId: userId,
        });
      }

      merged++;
    }

    // ── Re-attribute bookmarks ───────────────────────────────────────────────
    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_principal", (q) =>
        q.eq("principalType", "anon").eq("principalId", args.anonId)
      )
      .collect();
    for (const bk of bookmarks) {
      await ctx.db.patch(bk._id, {
        principalType: "user",
        principalId: userId,
      });
    }

    // ── Carry today's usage count forward ────────────────────────────────────
    // Messages sent as anon count against today's signed-in limit to prevent
    // gaming the rate limit by signing in after exhausting the anon quota.
    const today = new Date().toISOString().split("T")[0];
    const anonCounter = await ctx.db
      .query("usage_counters")
      .withIndex("by_principal_date", (q) =>
        q
          .eq("principalType", "anon")
          .eq("principalId", args.anonId)
          .eq("date", today)
      )
      .first();

    if (anonCounter && anonCounter.messageCount > 0) {
      const userCounter = await ctx.db
        .query("usage_counters")
        .withIndex("by_principal_date", (q) =>
          q
            .eq("principalType", "user")
            .eq("principalId", userId)
            .eq("date", today)
        )
        .first();

      if (userCounter) {
        await ctx.db.patch(userCounter._id, {
          messageCount: userCounter.messageCount + anonCounter.messageCount,
        });
      } else {
        await ctx.db.insert("usage_counters", {
          principalType: "user",
          principalId: userId,
          date: today,
          messageCount: anonCounter.messageCount,
        });
      }
    }

    // ── Record merge lineage ─────────────────────────────────────────────────
    await ctx.db.insert("principal_aliases", {
      fromPrincipalId: args.anonId,
      toPrincipalId: userId,
      mergedAt: Date.now(),
    });

    return { merged, alreadyDone: false };
  },
});
