"use client";

import { useSyncExternalStore } from "react";
import { useUser } from "@clerk/nextjs";
import { getOrCreateAnonId } from "@/lib/anon-id";

export type PrincipalType = "anon" | "user";

export interface Principal {
  principalType: PrincipalType;
  principalId: string;
  userId?: string;
  isLoading: boolean;
}

export function usePrincipal(): Principal {
  const { user, isLoaded } = useUser();
  const anonId = useSyncExternalStore(
    () => () => {},
    () => getOrCreateAnonId(),
    () => null
  );

  if (!isLoaded || anonId === null) {
    return { principalType: "anon", principalId: "", isLoading: true };
  }

  if (user) {
    return {
      principalType: "user",
      principalId: user.id,
      userId: user.id,
      isLoading: false,
    };
  }

  return {
    principalType: "anon",
    principalId: anonId,
    isLoading: false,
  };
}
