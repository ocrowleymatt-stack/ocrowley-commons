/**
 * Lightweight manuscript intake helpers.
 * Source inspiration: Caspa studio UniversalIntakeEngine + rewire input typing.
 */
import { detectInputType, type InputType } from '@ocrowley/intent';

export interface IntakeResult {
  inputType: InputType;
  wordCount: number;
  chapterHints: string[];
  preview: string;
}

export function ingestText(content: string, command = ''): IntakeResult {
  const inputType = detectInputType(content, command);
  const words = content.trim().split(/\s+/).filter(Boolean);
  const chapterHints = [...content.matchAll(/^#+\s*(.+)$/gm)].map((m) => m[1].trim());
  if (chapterHints.length === 0) {
    for (const m of content.matchAll(/^(chapter\s+\d+[^\n]*)/gim)) {
      chapterHints.push(m[1].trim());
    }
  }
  return {
    inputType,
    wordCount: words.length,
    chapterHints,
    preview: content.slice(0, 400),
  };
}
