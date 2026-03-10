import type { MutationCtx, QueryCtx } from "./_generated/server";

type PrincipalType = "anon" | "user";

function looksLikeAnonId(value: string): boolean {
  // Accept UUID-like IDs used by the app; reject obviously malformed values.
  return /^[a-f0-9-]{16,64}$/i.test(value);
}

/**
 * Enforce server-side principal checks instead of trusting client-provided IDs.
 * - user principals must match the authenticated Clerk subject
 * - anon principals must be structurally valid
 */
export async function assertPrincipalAccess(
  ctx: MutationCtx | QueryCtx,
  principalType: PrincipalType,
  principalId: string
): Promise<void> {
  if (principalType === "user") {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== principalId) {
      throw new Error("Unauthorized principal access");
    }
    return;
  }

  if (!looksLikeAnonId(principalId)) {
    throw new Error("Invalid anonymous principal");
  }
}
