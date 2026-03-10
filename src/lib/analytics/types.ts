export type PrincipalType = "anon" | "user";
export type Mode = "guest" | "byok";

export type EventName =
  | "app_open"
  | "session_heartbeat"
  | "session_end"
  | "thread_created"
  | "message_sent"
  | "assistant_response_received"
  | "assistant_response_failed"
  | "bookmark_added"
  | "citation_opened"
  | "signin_completed"
  | "principal_merged"
  | "byok_settings_opened"
  | "byok_connection_tested"
  | "mode_switched_guest_to_byok"
  | "mode_switched_byok_to_guest";

export interface EventEnvelope<TName extends EventName, TProps> {
  eventId: string;
  schemaVersion: 1;
  eventName: TName;
  principalType: PrincipalType;
  principalId: string;
  sessionId?: string;
  timestamp: number;
  source: "client" | "server";
  properties: TProps;
}

export interface AppOpenProps {
  path: string;
  referrer?: string;
  userAgentClass?: "mobile" | "desktop" | "tablet" | "unknown";
}

export interface SessionHeartbeatProps {
  path: string;
  activeMsSinceStart: number;
}

export interface SessionEndProps {
  durationMs: number;
  heartbeatCount: number;
  reason: "tab_close" | "app_background" | "timeout" | "manual";
}

export interface ThreadCreatedProps {
  threadId: string;
  philosopherId: string;
  philosopherSlug: string;
  mode: Mode;
}

export interface MessageSentProps {
  threadId: string;
  philosopherId: string;
  philosopherSlug: string;
  mode: Mode;
  messageLength: number;
}

export interface AssistantResponseReceivedProps {
  threadId: string;
  messageId: string;
  philosopherId: string;
  philosopherSlug: string;
  mode: Mode;
  latencyMs: number;
  citationCount: number;
  responseLength: number;
  crisisDetected: boolean;
}

export interface AssistantResponseFailedProps {
  threadId: string;
  philosopherId: string;
  philosopherSlug: string;
  mode: Mode;
  failureClass:
    | "provider_error"
    | "timeout"
    | "rate_limited"
    | "validation_error"
    | "unknown";
  statusCode?: number;
}

export interface BookmarkAddedProps {
  threadId: string;
  messageId?: string;
  philosopherId: string;
  philosopherSlug: string;
}

export interface CitationOpenedProps {
  threadId: string;
  messageId: string;
  philosopherId: string;
  philosopherSlug: string;
  sourceTextId: string;
  workTitle: string;
  chapterRef: string;
}

export interface SigninCompletedProps {
  method: "google" | "github" | "email" | "other";
}

export interface PrincipalMergedProps {
  fromPrincipalId: string;
  toPrincipalId: string;
  mergeReason: "signin";
}

export interface ByokSettingsOpenedProps {
  currentMode: Mode;
}

export interface ByokConnectionTestedProps {
  provider: string;
  model?: string;
  keyStorageMode: "session" | "persistent";
  success: boolean;
  latencyMs?: number;
}

export interface ModeSwitchedGuestToByokProps {
  provider: string;
  model?: string;
  keyStorageMode: "session" | "persistent";
}

export interface ModeSwitchedByokToGuestProps {
  previousProvider?: string;
}

export type ProductEvent =
  | EventEnvelope<"app_open", AppOpenProps>
  | EventEnvelope<"session_heartbeat", SessionHeartbeatProps>
  | EventEnvelope<"session_end", SessionEndProps>
  | EventEnvelope<"thread_created", ThreadCreatedProps>
  | EventEnvelope<"message_sent", MessageSentProps>
  | EventEnvelope<"assistant_response_received", AssistantResponseReceivedProps>
  | EventEnvelope<"assistant_response_failed", AssistantResponseFailedProps>
  | EventEnvelope<"bookmark_added", BookmarkAddedProps>
  | EventEnvelope<"citation_opened", CitationOpenedProps>
  | EventEnvelope<"signin_completed", SigninCompletedProps>
  | EventEnvelope<"principal_merged", PrincipalMergedProps>
  | EventEnvelope<"byok_settings_opened", ByokSettingsOpenedProps>
  | EventEnvelope<"byok_connection_tested", ByokConnectionTestedProps>
  | EventEnvelope<"mode_switched_guest_to_byok", ModeSwitchedGuestToByokProps>
  | EventEnvelope<"mode_switched_byok_to_guest", ModeSwitchedByokToGuestProps>;
