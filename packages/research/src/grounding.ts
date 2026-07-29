/**
 * Evidence grounding helpers.
 * Source: nexus-backend hallucinationGuardrail.js (pure functions only).
 */
export function groundEntity(entityValue: string, sourceTexts: string[]): number {
  const needle = entityValue.toLowerCase().trim();
  if (!needle) return 0;
  let bestScore = 0;
  for (const text of sourceTexts) {
    const haystack = text.toLowerCase();
    if (haystack.includes(needle)) return 100;
    const words = needle.split(/\s+/).filter((w) => w.length > 2);
    if (words.length > 1) {
      const matchCount = words.filter((w) => haystack.includes(w)).length;
      const score = Math.round((matchCount / words.length) * 80);
      if (score > bestScore) bestScore = score;
    }
  }
  return bestScore;
}

export function isGrounded(entityValue: string, sourceTexts: string[], threshold = 60): boolean {
  return groundEntity(entityValue, sourceTexts) >= threshold;
}
