/**
 * Bridge: map recursive OSINT results → SpiderDash / ARCANUM intel entities.
 * Used by spiderdash-ios native shell and spiderfoot-ui Intel Hub.
 */

import type { RecursiveOsintResult, OsintEvidenceItem } from './recursiveEngine.js';
import type { RefinementSeed } from './refinementLoop.js';
export {
  SPIDERDASH_DEFAULT_URL,
  SPIDERFOOT_DEFAULT_URL,
  BIGBROTHER_DEFAULT_URL,
  resolveSpiderdashUrl,
  resolveSpiderfootUrl,
  resolveBigbrotherUrl,
  applyBridgeUrlDefaults,
} from './bridgeDefaults.js';

export interface SpiderdashEntity {
  type: string;
  value: string;
  tags: string[];
  notes: string;
  riskScore: number | null;
  source: 'ocrowley-recursive-osint';
  evidenceKeys: string[];
}

export interface SpiderdashFlipperCommand {
  label: string;
  cli: string;
  entityValue: string;
}

/** Flipper Zero BLE serial profile (matches spiderfoot-ui useFlipperBle). */
export const FLIPPER_BLE = {
  serviceUuid: '0000fef6-0000-1000-8000-00805f9b34fb',
  txUuid: '0000fef7-0000-1000-8000-00805f9b34fb',
  rxUuid: '0000fef8-0000-1000-8000-00805f9b34fb',
  /** Alternate RPC profile used by some DeviceContext builds */
  rpcServiceUuid: '19ed82ae-ed21-4c9d-4145-228e62fe0000',
  rpcTxUuid: '19ed82ae-ed21-4c9d-4145-228e62fe0001',
  rpcRxUuid: '19ed82ae-ed21-4c9d-4145-228e62fe0003',
} as const;

export function evidenceToEntities(result: RecursiveOsintResult): SpiderdashEntity[] {
  const byValue = new Map<string, SpiderdashEntity>();

  const upsert = (type: string, value: string, extraTags: string[], note: string, score: number) => {
    const key = `${type}:${value.toLowerCase()}`;
    const existing = byValue.get(key);
    if (existing) {
      existing.tags = [...new Set([...existing.tags, ...extraTags])];
      existing.notes = `${existing.notes}\n${note}`.trim();
      existing.riskScore = Math.max(existing.riskScore ?? 0, score);
      return;
    }
    byValue.set(key, {
      type,
      value,
      tags: [...extraTags, 'recursive-osint'],
      notes: note,
      riskScore: score,
      source: 'ocrowley-recursive-osint',
      evidenceKeys: [],
    });
  };

  for (const seed of result.seeds) {
    upsert(seed.type, seed.value, [`seed:${seed.source}`], `Seed confidence ${seed.confidence}`, seed.confidence);
  }

  for (const item of result.evidence) {
    if (item.entity === '*') continue;
    const ent = byValue.get(`${inferType(item)}:${item.entity.toLowerCase()}`);
    if (ent) {
      ent.evidenceKeys.push(item.key);
      ent.notes = `${ent.notes}\n[${item.source}] ${item.title}: ${item.snippet}`.trim();
      ent.tags = [...new Set([...ent.tags, item.source])];
      ent.riskScore = Math.max(ent.riskScore ?? 0, item.score ?? 50);
    } else {
      upsert(inferType(item), item.entity, [item.source], `[${item.source}] ${item.title}: ${item.snippet}`, item.score ?? 50);
      byValue.get(`${inferType(item)}:${item.entity.toLowerCase()}`)?.evidenceKeys.push(item.key);
    }
  }

  return [...byValue.values()];
}

function inferType(item: OsintEvidenceItem): string {
  if (item.entity.includes('@')) return 'email';
  if (item.url?.includes('github.com') || item.source === 'platform-probe') return 'username';
  return 'unknown';
}

/** Suggest Flipper CLI commands linked to OSINT entity types (passive / research only). */
export function suggestFlipperCommands(seeds: RefinementSeed[]): SpiderdashFlipperCommand[] {
  const cmds: SpiderdashFlipperCommand[] = [];
  for (const s of seeds) {
    if (s.type === 'username' || s.type === 'person') {
      cmds.push({
        label: `Status (${s.value})`,
        cli: 'status\r\n',
        entityValue: s.value,
      });
    }
    if (s.type === 'domain' || s.type === 'url') {
      cmds.push({
        label: `BT scan context (${s.value})`,
        cli: 'bt info\r\n',
        entityValue: s.value,
      });
    }
  }
  if (!cmds.length) {
    cmds.push({ label: 'Flipper status', cli: 'status\r\n', entityValue: '*' });
  }
  return cmds;
}

export function buildSpiderdashImportPayload(result: RecursiveOsintResult): {
  entities: SpiderdashEntity[];
  flipperCommands: SpiderdashFlipperCommand[];
  brief: RecursiveOsintResult['brief'];
  toolsReady: string[];
} {
  return {
    entities: evidenceToEntities(result),
    flipperCommands: suggestFlipperCommands(result.seeds),
    brief: result.brief,
    toolsReady: result.tools.tools.filter(t => t.ready).map(t => t.id),
  };
}
