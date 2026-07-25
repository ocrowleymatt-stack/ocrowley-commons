import { aiOrchestrator, type AIRequest, type AIResponse } from '@ocrowley/ai-client';
import { LITERARY_SYSTEM, outlinePrompt, scenePrompt, critiquePrompt, cutPrompt } from './prompts.js';

export class LiteraryAI {
  constructor(private readonly orchestrator = aiOrchestrator) {}

  private call(prompt: string, extra?: Partial<AIRequest>): Promise<AIResponse> {
    return this.orchestrator.generate({
      prompt,
      context: LITERARY_SYSTEM,
      temperature: 0.7,
      ...extra,
    });
  }

  outline(premise: string, genre: string, chapters: number) {
    return this.call(outlinePrompt(premise, genre, chapters), { temperature: 0.5 });
  }

  writeScene(opts: Parameters<typeof scenePrompt>[0]) {
    return this.call(scenePrompt(opts));
  }

  critique(excerpt: string, mode?: string) {
    return this.call(critiquePrompt(excerpt, mode), { temperature: 0.3 });
  }

  cut(excerpt: string, targetReduction?: number) {
    return this.call(cutPrompt(excerpt, targetReduction), { temperature: 0.4 });
  }
}

export const literaryAI = new LiteraryAI();
