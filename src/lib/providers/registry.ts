import { groqGuestProvider } from "./guest-groq";
import type { InferenceProvider } from "./types";

const providers: Record<string, InferenceProvider> = {
  groq: groqGuestProvider,
};

export function getProvider(name: string): InferenceProvider {
  const p = providers[name];
  if (!p) throw new Error(`Provider "${name}" not registered`);
  return p;
}

export const ACTIVE_GUEST_PROVIDER = process.env.GUEST_PROVIDER ?? "groq";
