import { getAnonId } from "./anon-id";

export type PrincipalType = "anon" | "user";

export interface Principal {
  principalType: PrincipalType;
  principalId: string;
  userId?: string;
}

// Client-side principal resolution.
// For server-side use in API routes, use Clerk auth() directly.
export function resolvePrincipal(clerkUserId?: string | null): Principal {
  if (clerkUserId) {
    return {
      principalType: "user",
      principalId: clerkUserId,
      userId: clerkUserId,
    };
  }

  const anonId = getAnonId();
  return {
    principalType: "anon",
    principalId: anonId ?? "no-anon-id",
  };
}
