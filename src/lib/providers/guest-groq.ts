import type { InferenceProvider, ProviderConfig, ChatMessage } from "./types";

export const groqGuestProvider: InferenceProvider = {
  name: "groq",
  async complete(_messages: ChatMessage[], _config: ProviderConfig): Promise<string> {
    // TODO M2: Implement Groq API call
    // Guest mode: use server-side GROQ_API_KEY from env (never exposed to client)
    // BYOK mode: key provided by user, session or persistent storage
    throw new Error("Groq provider not yet implemented, stub for scaffold");
  },
};
