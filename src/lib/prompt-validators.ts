const CITATION_PATTERN = /\[CIT:([A-Za-z0-9._:-]+)\]/g;
const BULLET_PATTERN = /^\s*[-*]\s+/;

export interface CitationValidationResult {
  isValid: boolean;
  usedCitationIds: string[];
  invalidCitationIds: string[];
}

export interface DifferenceSummaryValidationResult {
  isValid: boolean;
  bulletCount: number;
  errors: string[];
}

export function extractCitationIds(text: string): string[] {
  const ids: string[] = [];
  for (const match of text.matchAll(CITATION_PATTERN)) {
    ids.push(match[1]);
  }
  return ids;
}

export function validateCitations(
  text: string,
  allowedCitationIds: string[],
): CitationValidationResult {
  const allowedSet = new Set(allowedCitationIds);
  const usedCitationIds = extractCitationIds(text);
  const invalidCitationIds = usedCitationIds.filter((id) => !allowedSet.has(id));
  return {
    isValid: invalidCitationIds.length === 0,
    usedCitationIds,
    invalidCitationIds,
  };
}

export function validateDifferenceSummary(text: string): DifferenceSummaryValidationResult {
  const lines = text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
  const bullets = lines.filter((line) => BULLET_PATTERN.test(line));

  const errors: string[] = [];
  if (bullets.length !== 3) {
    errors.push("Difference summary must contain exactly 3 bullets.");
  }

  for (const bullet of bullets) {
    const bulletBody = bullet.replace(BULLET_PATTERN, "").trim();
    if (!bulletBody) {
      errors.push("Bullet must not be empty.");
      continue;
    }

    const sentenceCount = bulletBody
      .split(/[.!?]+/)
      .map((part) => part.trim())
      .filter(Boolean).length;
    if (sentenceCount !== 1) {
      errors.push("Each bullet must be exactly one sentence.");
    }
  }

  return {
    isValid: errors.length === 0,
    bulletCount: bullets.length,
    errors,
  };
}
