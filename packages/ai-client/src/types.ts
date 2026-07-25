/** Minimal AI types for @ocrowley/ai-client (from Caspa studio shared types). */
export interface AIRequest {
  prompt: string;
  context?: string;
  model?: string;
  projectId?: string;
  chapterId?: string;
  temperature?: number;
  maxTokens?: number;
  system?: string;
}

export interface AIResponse {
  text: string;
  model: string;
  tokensUsed?: number;
  duration?: number;
  provider?: string;
}

export interface AIClientConfig {
  ollamaUrl: string;
  ollamaModel: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  grokApiKey?: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}
