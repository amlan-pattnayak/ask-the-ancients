export type ProviderMode = "guest" | "byok";
export type KeyStorageMode = "session" | "persistent";

export interface ProviderConfig {
  provider: string;
  mode: ProviderMode;
  keyStorageMode: KeyStorageMode;
  model?: string;
  customEndpoint?: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface InferenceProvider {
  name: string;
  complete(messages: ChatMessage[], config: ProviderConfig): Promise<string>;
}
