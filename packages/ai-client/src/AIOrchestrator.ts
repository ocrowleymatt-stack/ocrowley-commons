import type { AIRequest, AIResponse } from './types.js';
import { logger } from './logger.js';
import {
  anthropicGenerate,
  geminiGenerate,
  grokGenerate,
  isAnthropicConfigured,
  isGeminiConfigured,
  isGrokConfigured,
  isOpenAIConfigured,
  openaiGenerate,
} from './CloudProviders.js';
import { OllamaClient, ollamaClient } from './OllamaClient.js';

const MAX_CONTEXT_TOKENS = 4000;
const CHARS_PER_TOKEN = 4;

export class NoProviderAvailableError extends Error {
  constructor(details: string[] = []) {
    const summary = details.length
      ? `No AI provider could complete the request. ${details.slice(0, 3).join(' · ')}`
      : 'No AI provider is available. Configure Ollama or a cloud API key.';
    super(summary);
    this.name = 'NoProviderAvailableError';
  }
}

type ProviderName = 'ollama' | 'gemini' | 'grok' | 'openai' | 'anthropic';

interface ProviderEntry {
  name: ProviderName;
  label: string;
  isLocal: boolean;
  isConfigured: () => Promise<boolean>;
  generate: (req: AIRequest) => Promise<AIResponse>;
}

function truncateToTokenLimit(text: string, maxTokens: number): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n...[truncated]`;
}

/**
 * Portable multi-provider orchestrator.
 * Source: Caspa caspa-studio AIOrchestrator (DB/event wiring removed for library use).
 */
export class AIOrchestrator {
  private readonly ollama: OllamaClient;
  private readonly providers: ProviderEntry[];

  constructor(ollama: OllamaClient = ollamaClient) {
    this.ollama = ollama;
    this.providers = [
      {
        name: 'ollama',
        label: 'Ollama',
        isLocal: true,
        isConfigured: () => this.ollama.isAvailable(),
        generate: (req) => this.ollama.generate(req),
      },
      {
        name: 'gemini',
        label: 'Gemini',
        isLocal: false,
        isConfigured: isGeminiConfigured,
        generate: (req) => geminiGenerate(req),
      },
      {
        name: 'grok',
        label: 'Grok',
        isLocal: false,
        isConfigured: isGrokConfigured,
        generate: (req) => grokGenerate(req),
      },
      {
        name: 'openai',
        label: 'OpenAI',
        isLocal: false,
        isConfigured: isOpenAIConfigured,
        generate: (req) => openaiGenerate(req),
      },
      {
        name: 'anthropic',
        label: 'Anthropic',
        isLocal: false,
        isConfigured: isAnthropicConfigured,
        generate: (req) => anthropicGenerate(req),
      },
    ];
  }

  async generate(request: AIRequest, preferLocal = true): Promise<AIResponse> {
    const prompt = request.context
      ? `${truncateToTokenLimit(request.context, MAX_CONTEXT_TOKENS)}\n\n${request.prompt}`
      : request.prompt;

    const ordered = preferLocal
      ? this.providers
      : [...this.providers].sort((a, b) => Number(a.isLocal) - Number(b.isLocal));

    const failures: string[] = [];
    for (const provider of ordered) {
      try {
        if (!(await provider.isConfigured())) {
          failures.push(`${provider.label}: not configured`);
          continue;
        }
        const response = await provider.generate({ ...request, prompt });
        logger.info(`AI via ${provider.label}`);
        return { ...response, provider: provider.name };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failures.push(`${provider.label}: ${msg}`);
        logger.warn(`Provider ${provider.label} failed: ${msg}`);
      }
    }
    throw new NoProviderAvailableError(failures);
  }

  async listAvailableProviders(): Promise<string[]> {
    const available: string[] = [];
    for (const p of this.providers) {
      if (await p.isConfigured()) available.push(p.name);
    }
    return available;
  }
}

export const aiOrchestrator = new AIOrchestrator();
