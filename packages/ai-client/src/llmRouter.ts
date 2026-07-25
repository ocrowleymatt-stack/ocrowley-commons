/**
 * Caspa LLM Router — local Ollama for cheap tasks, paid APIs for quality
 */

type CheapTaskResult = { text: string; provider: 'ollama' | 'paid' };

let ollamaAvailableCache: { value: boolean; checkedAt: number } | null = null;
const OLLAMA_CACHE_MS = 30_000;

async function isOllamaAvailable(): Promise<boolean> {
  const now = Date.now();
  if (ollamaAvailableCache && now - ollamaAvailableCache.checkedAt < OLLAMA_CACHE_MS) {
    return ollamaAvailableCache.value;
  }
  try {
    const res = await fetch('/api/ollama/health');
    if (!res.ok) {
      ollamaAvailableCache = { value: false, checkedAt: now };
      return false;
    }
    const data = (await res.json()) as { available?: boolean };
    const available = Boolean(data.available);
    ollamaAvailableCache = { value: available, checkedAt: now };
    return available;
  } catch {
    ollamaAvailableCache = { value: false, checkedAt: now };
    return false;
  }
}

async function callOllama(prompt: string, system?: string): Promise<string | null> {
  try {
    const res = await fetch('/api/ollama/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mistral',
        prompt,
        system,
        temperature: 0.2,
        num_predict: 256,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { response?: string };
    return data.response?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Cheap classification / extraction — tries Ollama first, falls back to paid /api/ai/call
 */
export async function callCheapTask(
  prompt: string,
  fallback: () => Promise<string | undefined>
): Promise<CheapTaskResult> {
  if (await isOllamaAvailable()) {
    const local = await callOllama(
      prompt,
      'You are a precise literary assistant. Answer briefly and literally.'
    );
    if (local) return { text: local, provider: 'ollama' };
  }

  const paid = await fallback();
  return { text: paid || '', provider: 'paid' };
}

export function clearOllamaCache(): void {
  ollamaAvailableCache = null;
}
