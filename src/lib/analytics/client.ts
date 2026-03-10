import type { EventName, EventEnvelope, PrincipalType } from "@/lib/analytics/types";

const SESSION_STORAGE_KEY = "ata_session_id";
const SESSION_OWNER_KEY = "ata_session_owner";

function createSessionId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "server-session";
  const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;
  const id = createSessionId();
  sessionStorage.setItem(SESSION_STORAGE_KEY, id);
  return id;
}

export function ensureSessionForPrincipal(
  principalType: PrincipalType,
  principalId: string
): string {
  if (typeof window === "undefined") return "server-session";

  const expectedOwner = `${principalType}:${principalId}`;
  const currentOwner = sessionStorage.getItem(SESSION_OWNER_KEY);
  const currentSession = sessionStorage.getItem(SESSION_STORAGE_KEY);

  if (currentSession && currentOwner === expectedOwner) {
    return currentSession;
  }

  const nextSession = createSessionId();
  sessionStorage.setItem(SESSION_STORAGE_KEY, nextSession);
  sessionStorage.setItem(SESSION_OWNER_KEY, expectedOwner);
  return nextSession;
}

export function createClientEvent<TName extends EventName, TProps>(args: {
  eventName: TName;
  principalType: PrincipalType;
  principalId: string;
  sessionId?: string;
  properties: TProps;
}): EventEnvelope<TName, TProps> {
  return {
    eventId:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    schemaVersion: 1,
    eventName: args.eventName,
    principalType: args.principalType,
    principalId: args.principalId,
    sessionId: args.sessionId ?? getOrCreateSessionId(),
    timestamp: Date.now(),
    source: "client",
    properties: args.properties,
  };
}
