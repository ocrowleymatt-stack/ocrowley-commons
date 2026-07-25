/**
 * Heuristic human-voice scoring (portable subset).
 * Source inspiration: Caspa caspa-studio HumanVoiceEngine.
 */
export interface HumanVoiceResult {
  score: number;
  status: 'human' | 'mixed' | 'synthetic';
  notes: string[];
}

export class HumanVoiceEngine {
  assess(text: string): HumanVoiceResult {
    const notes: string[] = [];
    const words = text.trim().split(/\s+/).filter(Boolean);
    const avgWordLen = words.length ? words.reduce((s, w) => s + w.length, 0) / words.length : 0;
    const contractions = (text.match(/\b\w+'\w+\b/g) || []).length;
    const questions = (text.match(/\?/g) || []).length;
    let score = 70;
    if (avgWordLen > 7) { score -= 10; notes.push('Average word length is high — favour plainer diction.'); }
    if (contractions === 0 && words.length > 80) { score -= 8; notes.push('No contractions — voice may feel formal/synthetic.'); }
    if (questions > 0) score += 5;
    if (/\b(delve|tapestry|multifaceted|landscape of)\b/i.test(text)) {
      score -= 15; notes.push('AI-favoured vocabulary detected.');
    }
    score = Math.max(0, Math.min(100, score));
    const status = score >= 70 ? 'human' : score >= 45 ? 'mixed' : 'synthetic';
    return { score, status, notes };
  }
}

export const humanVoiceEngine = new HumanVoiceEngine();
