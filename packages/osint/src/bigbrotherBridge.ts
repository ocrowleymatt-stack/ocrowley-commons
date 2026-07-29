/**
 * Ensure the private BigBrother HTTP bridge is reachable (auto-start locally).
 */

import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyBridgeUrlDefaults, resolveBigbrotherUrl } from './bridgeDefaults.js';

let started: ChildProcess | null = null;

export async function pingBigBrotherBridge(baseUrl?: string): Promise<{
  ok: boolean;
  bigbrotherAvailable?: boolean;
  modulesRegistered?: number;
}> {
  const base = (baseUrl || resolveBigbrotherUrl()).replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as {
      ok?: boolean;
      bigbrotherAvailable?: boolean;
      modulesRegistered?: number;
    };
    return {
      ok: Boolean(data.ok),
      bigbrotherAvailable: data.bigbrotherAvailable,
      modulesRegistered: data.modulesRegistered,
    };
  } catch {
    return { ok: false };
  }
}

function pythonCandidates(): string[] {
  return [process.env.OCROWLEY_PYTHON, 'python3', 'python'].filter(Boolean) as string[];
}

function packageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // dist/ → packages/osint → repo root → python/ocrowley_osint
  return path.resolve(here, '../../../python/ocrowley_osint');
}

/** Start `python -m ocrowley_osint` on the bridge port if health fails. */
export async function ensureBigBrotherBridge(opts: {
  autoStart?: boolean;
  waitMs?: number;
} = {}): Promise<{
  url: string;
  ready: boolean;
  started: boolean;
  bigbrotherAvailable?: boolean;
  detail: string;
}> {
  applyBridgeUrlDefaults();
  const url = resolveBigbrotherUrl();
  const ping = await pingBigBrotherBridge(url);
  if (ping.ok) {
    return {
      url,
      ready: true,
      started: false,
      bigbrotherAvailable: ping.bigbrotherAvailable,
      detail: `already running (${ping.modulesRegistered ?? '?'} modules)`,
    };
  }

  if (opts.autoStart === false || process.env.OCROWLEY_BB_AUTOSTART === '0') {
    return { url, ready: false, started: false, detail: 'not running (autostart disabled)' };
  }

  if (started && !started.killed) {
    // already spawning — wait
  } else {
    const port = Number(new URL(url).port || 8798);
    const host = new URL(url).hostname || '127.0.0.1';
    const cwd = packageRoot();
    let spawned = false;
    for (const bin of pythonCandidates()) {
      try {
        started = spawn(bin, ['-m', 'ocrowley_osint', '--host', host, '--port', String(port)], {
          cwd,
          env: { ...process.env, PYTHONPATH: cwd },
          stdio: 'ignore',
          detached: true,
        });
        started.unref();
        spawned = true;
        break;
      } catch {
        started = null;
      }
    }
    if (!spawned) {
      return {
        url,
        ready: false,
        started: false,
        detail: 'could not spawn python -m ocrowley_osint (install python package)',
      };
    }
  }

  const waitMs = opts.waitMs ?? 4000;
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 250));
    const again = await pingBigBrotherBridge(url);
    if (again.ok) {
      return {
        url,
        ready: true,
        started: true,
        bigbrotherAvailable: again.bigbrotherAvailable,
        detail: `started local bridge (${again.modulesRegistered ?? '?'} modules)`,
      };
    }
  }

  return {
    url,
    ready: false,
    started: true,
    detail: 'spawned but /health not ready — run: python -m ocrowley_osint --port 8798',
  };
}
