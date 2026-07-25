import { config } from './config.js';
import { logger } from './logger.js';
import type { AIRequest, AIResponse } from './types.js';

const OLLAMA_TIMEOUT_MS = 30_000;
const AVAILABILITY_TIMEOUT_MS = 2_000;

export class OllamaTimeoutError extends Error {
  constructor(message = 'Ollama request timed out after 30 seconds') {
    super(message);
    this.name = 'OllamaTimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, error: Error): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(error), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function ollamaFetch(path: string, init?: RequestInit, timeoutMs = OLLAMA_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${config.ollamaUrl}${path}`, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new OllamaTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export class OllamaClient {
  async isAvailable(): Promise<boolean> {
    try {
      const models = await this.listModels();
      return models.length > 0;
    } catch {
      return false;
    }
  }

  async resolveModel(requested?: string): Promise<string> {
    const models = await this.listModels();
    if (models.length === 0) {
      throw new Error('No Ollama models installed. Run: ollama pull mistral');
    }

    const preferred = requested ?? config.ollamaModel;
    if (models.includes(preferred)) {
      return preferred;
    }

    const tagged = models.find((name) => name.startsWith(`${preferred}:`));
    if (tagged) {
      return tagged;
    }

    logger.warn(`Ollama model "${preferred}" not found; falling back to "${models[0]}"`);
    return models[0];
  }

  async listModels(): Promise<string[]> {
    const response = await ollamaFetch('/api/tags');
    if (!response.ok) {
      throw new Error(`Ollama listModels failed: ${response.status}`);
    }

    const data = (await response.json()) as { models?: { name: string }[] };
    return (data.models ?? []).map((model) => model.name);
  }

  async generate(req: AIRequest): Promise<AIResponse> {
    const start = Date.now();
    const model = await this.resolveModel(req.model);
    const prompt = req.context ? `${req.context}\n\n${req.prompt}` : req.prompt;

    const response = await ollamaFetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: true,
        options: {
          temperature: req.temperature,
          num_predict: req.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama generate failed: ${response.status}`);
    }

    const text = await this.readStream(response);
    return {
      text,
      model,
      duration: Date.now() - start,
    };
  }

  async chat(
    messages: { role: string; content: string }[],
    model?: string,
  ): Promise<AIResponse> {
    const start = Date.now();
    const resolvedModel = await this.resolveModel(model);

    const response = await ollamaFetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: resolvedModel,
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama chat failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      message?: { content: string };
      eval_count?: number;
    };

    return {
      text: data.message?.content ?? '',
      model: resolvedModel,
      tokensUsed: data.eval_count,
      duration: Date.now() - start,
    };
  }

  async streamGenerate(
    req: AIRequest,
    onChunk: (text: string) => void,
  ): Promise<AIResponse> {
    const start = Date.now();
    const model = await this.resolveModel(req.model);
    const prompt = req.context ? `${req.context}\n\n${req.prompt}` : req.prompt;

    const response = await ollamaFetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: true,
        options: {
          temperature: req.temperature,
          num_predict: req.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama stream generate failed: ${response.status}`);
    }

    const text = await this.readStream(response, onChunk);
    return {
      text,
      model,
      duration: Date.now() - start,
    };
  }

  private async readStream(response: Response, onChunk?: (text: string) => void): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Ollama response has no body');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        try {
          const parsed = JSON.parse(line) as { response?: string; done?: boolean };
          if (parsed.response) {
            fullText += parsed.response;
            onChunk?.(parsed.response);
          }
        } catch (error) {
          logger.debug(`Ollama stream parse skip: ${String(error)}`);
        }
      }
    }

    return fullText;
  }
}

export const ollamaClient = new OllamaClient();
