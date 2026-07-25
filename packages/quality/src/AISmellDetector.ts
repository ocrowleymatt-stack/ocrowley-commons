/**
 * Portable AI-smell detector.
 * Source: Caspa caspa-studio AISmellDetector (qualityOrchestrator delegation inlined).
 */

export interface AISmellResult {
  score: number;
  status: 'natural' | 'mixed' | 'ai_heavy';
  signals: string[];
}

const AI_PATTERNS = [
  /in today's (world|society|fast-paced)/i,
  /it's worth noting/i,
  /delve into/i,
  /tapestry of/i,
  /multifaceted/i,
  /it's important to (note|remember)/i,
  /as an ai/i,
  /in conclusion,/i,
  /furthermore,/i,
];

const CLICHE_PATTERNS = [
  /only time will tell/i,
  /in the nick of time/i,
  /better late than never/i,
  /crystal clear/i,
  /at the end of the day/i,
];

export class AISmellDetector {
  detect(text: string): AISmellResult {
    const signals: string[] = [];
    for (const pattern of AI_PATTERNS) {
      if (pattern.test(text)) signals.push(`Pattern match: ${pattern.source}`);
    }
    for (const pattern of CLICHE_PATTERNS) {
      if (pattern.test(text)) signals.push(`Cliche: ${pattern.source}`);
    }
    const score = Math.max(0, 100 - signals.length * 15);
    const status = score >= 75 ? 'natural' : score >= 45 ? 'mixed' : 'ai_heavy';
    return { score: Math.round(score), status, signals };
  }
}

export const aiSmellDetector = new AISmellDetector();
