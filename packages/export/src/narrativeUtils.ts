
/**
 * Narrative Utilities for NovelWrite Pro
 */

/**
 * Detects word echoes (words repeated within a short distance)
 */
export function detectEchoes(text: string, windowSize: number = 50): { word: string, index: number }[] {
  const words = text.toLowerCase().match(/\b\w{4,}\b/g) || []; // only words 4+ chars
  const echoes: { word: string, index: number }[] = [];
  
  for (let i = 0; i < words.length; i++) {
    const current = words[i];
    const lookahead = words.slice(i + 1, i + windowSize);
    if (lookahead.includes(current)) {
      echoes.push({ word: current, index: i });
    }
  }
  
  return echoes;
}

/**
 * Simple similarity check between two strings (Jaccard similarity)
 */
export function calculateSimilarity(s1: string, s2: string): number {
  const set1 = new Set(s1.toLowerCase().match(/\b\w+\b/g) || []);
  const set2 = new Set(s2.toLowerCase().match(/\b\w+\b/g) || []);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * Checks for redundant chapters based on summaries
 */
export function findRedundantChapters(chapters: { id: string, title: string, summary: string }[]): { chapterId: string, duplicateOfId: string, similarity: number }[] {
  const redundant: { chapterId: string, duplicateOfId: string, similarity: number }[] = [];
  
  for (let i = 0; i < chapters.length; i++) {
    for (let j = i + 1; j < chapters.length; j++) {
      const sim = calculateSimilarity(chapters[i].summary, chapters[j].summary);
      if (sim > 0.6) { // High similarity threshold for summaries
        redundant.push({
          chapterId: chapters[j].id,
          duplicateOfId: chapters[i].id,
          similarity: sim
        });
      }
    }
  }
  
  return redundant;
}
