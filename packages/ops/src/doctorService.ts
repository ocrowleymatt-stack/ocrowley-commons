/**
 * Safe deploy diagnostics (no secrets).
 * Source: Caspa main doctorService (portable subset).
 */
import { probeUrl } from './deps.js';

export interface DoctorCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface DoctorReport {
  ok: boolean;
  checkedAt: string;
  checks: DoctorCheck[];
}

export async function runDoctor(opts: {
  ollamaUrl?: string;
  healthUrl?: string;
} = {}): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];
  const ollamaUrl = opts.ollamaUrl ?? process.env.OLLAMA_URL ?? 'http://localhost:11434';
  const healthUrl = opts.healthUrl ?? 'http://localhost:3000/health';

  const ollama = await probeUrl(`${ollamaUrl.replace(/\/$/, '')}/api/tags`);
  checks.push({
    name: 'ollama',
    status: ollama.ok ? 'pass' : 'warn',
    detail: ollama.ok ? 'Ollama reachable' : `Ollama unreachable: ${ollama.error ?? ollama.status}`,
  });

  const health = await probeUrl(healthUrl);
  checks.push({
    name: 'app-health',
    status: health.ok ? 'pass' : 'warn',
    detail: health.ok ? 'Health endpoint ok' : `Health check failed: ${health.error ?? health.status}`,
  });

  checks.push({
    name: 'env-gemini',
    status: process.env.GEMINI_API_KEY ? 'pass' : 'warn',
    detail: process.env.GEMINI_API_KEY ? 'GEMINI_API_KEY present' : 'GEMINI_API_KEY missing (cloud fallback unavailable)',
  });

  const ok = checks.every((c) => c.status !== 'fail');
  return { ok, checkedAt: new Date().toISOString(), checks };
}
