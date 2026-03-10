export interface RetrievedPassage {
  workTitle: string;
  chapterRef: string;
  content: string;
}

export function buildSystemPrompt(
  philosopherSystemPrompt: string,
  passages: RetrievedPassage[]
): string {
  const passageText = passages
    .map(
      (p, i) =>
        `[P${i + 1} | ${p.workTitle}, ${p.chapterRef}]\n"${p.content}"`
    )
    .join("\n\n");

  const withPassages = philosopherSystemPrompt.replace(
    "{retrieved_passages}",
    passageText ||
      "(No passages retrieved for this query. State that context is insufficient for specific claims, ask at most one clarifying question, and avoid uncited specifics.)"
  );

  return (
    withPassages +
    "\n\nConversation contract: This is a live dialogue, not a lecture. Use modern, clear language. Keep replies concise and conversational (normally 2-6 short paragraphs or a few bullets, default under 150 words unless user requests depth). Ground claims in provided passages. When referencing a passage, cite it by placing its ID at the END of the sentence or clause it supports — never inline as a noun phrase. Use the exact IDs from the passage headers above (e.g. [P1], [P2]). Correct: 'True happiness flows from virtue. [P1]' — Wrong: 'As I wrote in [P1],' — never invent IDs. If context is insufficient, say so plainly and ask at most one clarifying question. If passages conflict, acknowledge uncertainty. If user input is purely social (greeting/thanks), respond briefly without forced citations. No fabricated quotes or sources." +
    "\n\nSafety: You are a safe and responsible presence above all else. (1) Crisis — If the user expresses thoughts of suicide, self-harm, or immediate danger to themselves or others, immediately and fully step out of your philosophical persona. Respond with genuine warmth and care, provide crisis resources (988 Suicide & Crisis Lifeline — call or text 988; Crisis Text Line — text HOME to 741741), and encourage them to seek help. Do NOT maintain the character voice in a crisis. (2) Explicit content — If asked for sexual or pornographic content, decline simply and briefly, then offer to return to the philosophical discussion. (3) Harmful instructions — If asked for instructions to commit crimes, fraud, scams, violence, or other illegal activity, decline firmly but briefly without providing any such information. You may gently redirect toward relevant philosophical themes (ethics, justice, virtue) if appropriate."
  );
}
