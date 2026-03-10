/**
 * Safety utilities for pre-flight content screening.
 *
 * Crisis detection intentionally uses a small, high-signal keyword list rather
 * than an LLM classifier — we need guaranteed, zero-latency handling for
 * self-harm signals regardless of which provider the user has configured.
 *
 * NSFW and criminal-instruction refusals are handled via system-prompt
 * instructions in buildSystemPrompt (LLMs follow these reliably for those
 * categories; no pre-flight needed).
 */

// ─── Crisis detection ─────────────────────────────────────────────────────────

/**
 * High-confidence phrases indicating acute self-harm or suicidal crisis.
 * Deliberately narrow to avoid false positives on legitimate philosophical
 * discussions of mortality, Stoic acceptance of death, etc.
 */
const CRISIS_PHRASES: ReadonlyArray<string> = [
  "kill myself",
  "killing myself",
  "end my life",
  "ending my life",
  "take my life",
  "want to die",
  "going to die by suicide",
  "commit suicide",
  "committing suicide",
  "suicidal",
  "i want to be dead",
  "don't want to be alive",
  "don't want to live",
  "no reason to live",
  "not worth living",
  "life isn't worth living",
  "life is not worth living",
  "hurt myself",
  "hurting myself",
  "self-harm",
  "self harm",
];

/**
 * Returns true if the message contains a high-confidence crisis signal.
 * Case-insensitive; checks for phrase containment (not word boundaries).
 */
export function detectCrisis(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_PHRASES.some((phrase) => lower.includes(phrase));
}

// ─── Canned safe responses ────────────────────────────────────────────────────

/**
 * Response returned immediately when a crisis signal is detected.
 * Deliberately plain and human — no philosophical persona, no citations.
 *
 * Hotlines are listed by region so users don't have to navigate to a website
 * first. The IASP directory link serves as the universal catch-all for any
 * country not listed here.
 */
export const CRISIS_RESPONSE = `I'm stepping outside my role for a moment because what you've shared is important.

If you're having thoughts of suicide or self-harm, please reach out for support right now:

United States, 988 Suicide & Crisis Lifeline: call or text 988. Crisis Text Line: text HOME to 741741.

India, iCall (TISS): 9152987821 (Mon-Sat, 8 am-10 pm IST). Vandrevala Foundation: 1860-2662-345 (24/7).

United Kingdom, Samaritans: 116 123 (free, 24/7).

Australia, Lifeline: 13 11 14 (24/7).

Canada, Crisis Services Canada: 1-833-456-4566 (24/7).

For all other countries, find your local helpline at https://www.iasp.info/resources/Crisis_Centres/

You don't have to face this alone. These lines are free and confidential.

If you're in immediate danger, please call your local emergency services.`;
