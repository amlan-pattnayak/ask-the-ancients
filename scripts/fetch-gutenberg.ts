/**
 * Fetches and cleans plain text from Project Gutenberg.
 * Returns the raw text content with headers/footers stripped.
 */
export async function fetchGutenbergText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  let text = await response.text();

  // Strip Project Gutenberg header (everything before "*** START OF")
  const startMatch = text.match(/\*\*\* START OF (?:THE |THIS )?PROJECT GUTENBERG[^\n]*\n/i);
  if (startMatch) {
    text = text.slice(text.indexOf(startMatch[0]) + startMatch[0].length);
  }

  // Strip Project Gutenberg footer (everything from "*** END OF")
  const endMatch = text.match(/\*\*\* END OF (?:THE |THIS )?PROJECT GUTENBERG/i);
  if (endMatch) {
    text = text.slice(0, text.indexOf(endMatch[0]));
  }

  // Clean up
  text = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  return text;
}
