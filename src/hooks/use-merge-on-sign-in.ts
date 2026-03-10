"use client";

import { useMutation, useConvexAuth } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { api } from "@/lib/convex";
import { getAnonId } from "@/lib/anon-id";

// Per-user localStorage key that records which anonId was last merged, so we
// don't re-trigger the merge on every page load.
const MERGE_DONE_KEY_PREFIX = "ata_merge_done_";

/**
 * Detects when a user signs in and immediately merges their anonymous data
 * (threads, messages, bookmarks, usage counters) into their user account.
 *
 * Waits for `useConvexAuth().isAuthenticated` — not just Clerk's `useUser()`
 * — because `ConvexProviderWithClerk` forwards the JWT to Convex asynchronously.
 * Calling a Convex mutation before that token is set causes "Not authenticated".
 *
 * Mount this hook once near the root of the component tree (Providers.tsx).
 */
export function useMergeOnSignIn() {
  // isAuthenticated is true only once Convex has received and validated the
  // Clerk JWT — the correct signal before calling authenticated mutations.
  const { isAuthenticated, isLoading: convexAuthLoading } = useConvexAuth();
  const { user } = useUser();
  const mergeAnonToUser = useMutation(api.merge.mergeAnonToUser);
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (convexAuthLoading || !isAuthenticated || !user || hasTriggered.current) return;

    const anonId = getAnonId();
    if (!anonId) return;

    // Skip if this browser has already merged this anonId for this user.
    const mergeKey = MERGE_DONE_KEY_PREFIX + user.id;
    const lastMergedAnonId = localStorage.getItem(mergeKey);
    if (lastMergedAnonId === anonId) return;

    hasTriggered.current = true;

    fetch("/api/auth/merge-proof", { method: "GET", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json() as Promise<{ anonId: string; proof: string }>;
      })
      .then(({ anonId: proofAnonId, proof }) => {
        if (proofAnonId !== anonId) {
          throw new Error("Merge proof principal mismatch");
        }
        return mergeAnonToUser({ anonId, mergeProof: proof });
      })
      .then(() => {
        // Record locally so we don't re-run on next page load.
        localStorage.setItem(mergeKey, anonId);
      })
      .catch((err) => {
        console.error("[merge] Failed to merge anon data:", err);
        // Allow retry on next mount if this fails.
        hasTriggered.current = false;
      });
  }, [convexAuthLoading, isAuthenticated, user, mergeAnonToUser]);
}
