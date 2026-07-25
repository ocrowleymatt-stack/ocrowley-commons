import type { AIClientConfig } from './types.js';

export function getConfig(): AIClientConfig {
  return {
    ollamaUrl: process.env.OLLAMA_URL ?? 'http://localhost:11434',
    ollamaModel: process.env.OLLAMA_MODEL ?? 'mistral:latest',
    geminiApiKey: process.env.GEMINI_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    grokApiKey: process.env.GROK_API_KEY,
    logLevel: (process.env.LOG_LEVEL as AIClientConfig['logLevel']) || 'info',
  };
}

export const config: AIClientConfig = getConfig();
