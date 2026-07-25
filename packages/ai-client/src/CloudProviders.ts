import { config } from './config.js';
import type { AIRequest, AIResponse } from './types.js';

export class ProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`${provider} API key is not configured`);
    this.name = 'ProviderNotConfiguredError';
  }
}

export class ProviderRequestError extends Error {
  constructor(provider: string, status: number, detail: string) {
    super(`${provider} request failed (${status}): ${detail}`);
    this.name = 'ProviderRequestError';
  }
}

function buildPrompt(req: AIRequest): string {
  return req.context ? `${req.context}\n\n${req.prompt}` : req.prompt;
}

async function handleProviderResponse(
  provider: string,
  response: Response,
  model: string,
  start: number,
): Promise<AIResponse> {
  if (response.status === 429) {
    throw new ProviderRequestError(provider, 429, 'Rate limit exceeded');
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new ProviderRequestError(provider, response.status, detail.slice(0, 500));
  }

  return {
    text: '',
    model,
    duration: Date.now() - start,
  };
}

export async function geminiGenerate(req: AIRequest): Promise<AIResponse> {
  if (!config.geminiApiKey) {
    throw new ProviderNotConfiguredError('Gemini');
  }

  const start = Date.now();
  const model = req.model ?? 'gemini-2.0-flash';
  const prompt = buildPrompt(req);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: req.temperature,
          maxOutputTokens: req.maxTokens,
        },
      }),
    },
  );

  if (response.status === 429 || !response.ok) {
    const detail = await response.text();
    throw new ProviderRequestError('Gemini', response.status, detail.slice(0, 500));
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { totalTokenCount?: number };
  };

  const text =
    data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';

  return {
    text,
    model,
    tokensUsed: data.usageMetadata?.totalTokenCount,
    duration: Date.now() - start,
  };
}

export async function grokGenerate(req: AIRequest): Promise<AIResponse> {
  if (!config.grokApiKey) {
    throw new ProviderNotConfiguredError('Grok');
  }

  const start = Date.now();
  const model = req.model ?? 'grok-4.3';
  const prompt = buildPrompt(req);

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.grokApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: req.temperature,
      max_tokens: req.maxTokens,
    }),
  });

  const base = await handleProviderResponse('Grok', response, model, start);
  if (base.text !== '') {
    return base;
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { total_tokens?: number };
  };

  return {
    text: data.choices?.[0]?.message?.content ?? '',
    model,
    tokensUsed: data.usage?.total_tokens,
    duration: Date.now() - start,
  };
}

export async function openaiGenerate(req: AIRequest): Promise<AIResponse> {
  if (!config.openaiApiKey) {
    throw new ProviderNotConfiguredError('OpenAI');
  }

  const start = Date.now();
  const model = req.model ?? 'gpt-4o-mini';
  const prompt = buildPrompt(req);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: req.temperature,
      max_tokens: req.maxTokens,
    }),
  });

  if (response.status === 429 || !response.ok) {
    const detail = await response.text();
    throw new ProviderRequestError('OpenAI', response.status, detail.slice(0, 500));
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { total_tokens?: number };
  };

  return {
    text: data.choices?.[0]?.message?.content ?? '',
    model,
    tokensUsed: data.usage?.total_tokens,
    duration: Date.now() - start,
  };
}

export async function anthropicGenerate(req: AIRequest): Promise<AIResponse> {
  if (!config.anthropicApiKey) {
    throw new ProviderNotConfiguredError('Anthropic');
  }

  const start = Date.now();
  const model = req.model ?? 'claude-3-5-sonnet-20241022';
  const prompt = buildPrompt(req);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: req.maxTokens ?? 4096,
      messages: [{ role: 'user', content: prompt }],
      temperature: req.temperature,
    }),
  });

  if (response.status === 429 || !response.ok) {
    const detail = await response.text();
    throw new ProviderRequestError('Anthropic', response.status, detail.slice(0, 500));
  }

  const data = (await response.json()) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const text = data.content?.find((block) => block.type === 'text')?.text ?? '';
  const tokensUsed =
    data.usage?.input_tokens !== undefined && data.usage?.output_tokens !== undefined
      ? data.usage.input_tokens + data.usage.output_tokens
      : undefined;

  return {
    text,
    model,
    tokensUsed,
    duration: Date.now() - start,
  };
}

export async function isGeminiConfigured(): Promise<boolean> {
  return Boolean(config.geminiApiKey);
}

export async function isGrokConfigured(): Promise<boolean> {
  return Boolean(config.grokApiKey);
}

export async function isOpenAIConfigured(): Promise<boolean> {
  return Boolean(config.openaiApiKey);
}

export async function isAnthropicConfigured(): Promise<boolean> {
  return Boolean(config.anthropicApiKey);
}
