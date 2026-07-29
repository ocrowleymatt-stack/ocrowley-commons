/**
 * Full-toolkit discover + enrich adapters.
 * Wires every live commons/darkweb tool and optional bridges (BigBrother, SpiderFoot, CLIs).
 */

import {
  createDehashedProvider,
  createHibpProvider,
  monitorDarkWeb,
  searchAhmia,
  searchIntelX,
  type DarkwebAuthorization,
} from '@ocrowley/darkweb';
import { queryWayback } from './archive.js';
import { runAwaitableBridge, bridgeTimeoutMs } from './bridgeAwait.js';
import { resolveBigbrotherUrl, resolveSpiderfootUrl, applyBridgeUrlDefaults } from './bridgeDefaults.js';
import { runSpiderdashWhoScan } from './spiderdashClient.js';
import { detectExactDuplicates } from './dedup.js';
import { buildUsernameVariants, inferEntityType } from './normalize.js';
import { probeUsernamePlatforms } from './platforms.js';
import type { CritiqueReport } from './critiqueLoop.js';
import type { OsintEvidenceItem } from './recursiveEngine.js';
import type { RefinementSeed, SweepResult } from './refinementLoop.js';
import { listTools, toolStatus, type ToolSpec } from './toolCatalog.js';
import type { OsintAuthorization } from './policy.js';
import type { OsintEntity } from './types.js';

export interface ToolkitOptions {
  auth: OsintAuthorization;
  /** Required for Ahmia/HIBP/darkweb tools. If omitted, darkweb tools are skipped. */
  darkwebAuth?: DarkwebAuthorization;
  enableDarkweb?: boolean;
  enableArchive?: boolean;
  enablePlatformProbes?: boolean;
  enableBridges?: boolean;
  enableCliTools?: boolean;
  /** Limit parallel platform probes per sweep. */
  maxUsernamesPerSweep?: number;
  fetchText?: (url: string) => Promise<string | null>;
}

export interface ToolkitReport {
  tools: Array<{ id: string; ready: boolean; reason: string; family: ToolSpec['family'] }>;
  liveCount: number;
  bridgeReadyCount: number;
}

export function reportToolkitAvailability(opts: ToolkitOptions = { auth: stubAuth() }): ToolkitReport {
  const tools = listTools().map(t => {
    const status = toolStatus(t);
    // CLI tools also need explicit flag
    if (t.family === 'cli' && process.env.OCROWLEY_ENABLE_CLI_TOOLS !== '1' && !opts.enableCliTools) {
      return { ...status, ready: false, reason: 'OCROWLEY_ENABLE_CLI_TOOLS not enabled', family: t.family };
    }
    if (t.family === 'darkweb' && opts.enableDarkweb === false) {
      return { ...status, ready: false, reason: 'darkweb disabled', family: t.family };
    }
    if (t.family === 'darkweb' && !opts.darkwebAuth?.lawfulUseAcknowledged) {
      return { ...status, ready: false, reason: 'darkwebAuth.lawfulUseAcknowledged required', family: t.family };
    }
    return { ...status, family: t.family };
  });
  return {
    tools,
    liveCount: tools.filter(t => t.ready && listTools().find(x => x.id === t.id)?.runtime === 'live').length,
    bridgeReadyCount: tools.filter(t => t.ready && listTools().find(x => x.id === t.id)?.runtime !== 'live').length,
  };
}

function stubAuth(): OsintAuthorization {
  return { actorId: 'system', roles: ['osint-operator'], authorizationRef: 'toolkit-status', purpose: 'status' };
}

function pushItem(
  items: OsintEvidenceItem[],
  keys: string[],
  item: OsintEvidenceItem,
  seen: Set<string>,
): void {
  if (seen.has(item.key)) return;
  seen.add(item.key);
  items.push(item);
  keys.push(item.key);
}

async function runBridgeScanAndWait(
  baseEnv: string,
  startPath: string,
  body: unknown,
): Promise<Record<string, unknown> | null> {
  applyBridgeUrlDefaults();
  let base = process.env[baseEnv];
  if (baseEnv === 'OCROWLEY_SPIDERFOOT_URL') base = resolveSpiderfootUrl();
  if (baseEnv === 'OCROWLEY_BIGBROTHER_BRIDGE') base = resolveBigbrotherUrl() || undefined;
  if (!base) return null;
  return runAwaitableBridge({
    baseUrl: base,
    startPath,
    body,
    timeoutMs: bridgeTimeoutMs(),
  });
}

async function runCliTool(
  bin: string,
  args: string[],
  enabled: boolean,
): Promise<string | null> {
  if (!enabled && process.env.OCROWLEY_ENABLE_CLI_TOOLS !== '1') return null;
  try {
    const { spawn } = await import('node:child_process');
    return await new Promise(resolve => {
      const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      const timer = setTimeout(() => {
        proc.kill('SIGTERM');
        resolve(out || null);
      }, 25000);
      proc.stdout.on('data', (c: Buffer) => {
        out += c.toString();
      });
      proc.stderr.on('data', (c: Buffer) => {
        out += c.toString();
      });
      proc.on('close', () => {
        clearTimeout(timer);
        resolve(out || null);
      });
      proc.on('error', () => {
        clearTimeout(timer);
        resolve(null);
      });
    });
  } catch {
    return null;
  }
}

/** Create a discover() implementation that fans out across all available tools. */
export function createFullDiscover(opts: ToolkitOptions) {
  const enableArchive = opts.enableArchive !== false;
  const enablePlatforms = opts.enablePlatformProbes !== false;
  const enableDarkweb = opts.enableDarkweb !== false && Boolean(opts.darkwebAuth?.lawfulUseAcknowledged);
  const enableBridges = opts.enableBridges !== false;
  const enableCli = Boolean(opts.enableCliTools || process.env.OCROWLEY_ENABLE_CLI_TOOLS === '1');
  const maxUsers = opts.maxUsernamesPerSweep ?? 5;

  return async function discover(
    seeds: RefinementSeed[],
    sweepNumber: number,
  ): Promise<SweepResult<OsintEvidenceItem>> {
    const items: OsintEvidenceItem[] = [];
    const itemKeys: string[] = [];
    const discoveredSeeds: RefinementSeed[] = [];
    const seen = new Set<string>();
    const usedTools: string[] = [];

    // Person → username variants
    for (const s of seeds.filter(x => x.type === 'person' || x.type === 'name')) {
      const parts = s.value.trim().split(/\s+/);
      if (parts.length >= 2) {
        usedTools.push('username-variants');
        for (const v of buildUsernameVariants(parts[0], parts[parts.length - 1]).slice(0, 6)) {
          discoveredSeeds.push({
            type: 'username',
            value: v,
            confidence: 65,
            source: 'username-variants',
          });
        }
      }
    }

    // Platform probes
    if (enablePlatforms) {
      const usernames = seeds.filter(s => s.type === 'username').slice(0, maxUsers);
      for (const s of usernames) {
        usedTools.push('platform-probe');
        const hit = await probeUsernamePlatforms(s.value);
        for (const f of hit.found) {
          pushItem(
            items,
            itemKeys,
            {
              key: `platform:${f.url}`,
              entity: s.value,
              title: `${f.site} profile`,
              source: 'platform-probe',
              snippet: `reported profile url ${f.url}`,
              url: f.url,
              score: 72,
            },
            seen,
          );
        }
      }
    }

    // Wayback
    if (enableArchive) {
      const targets = seeds.filter(s => s.type === 'url' || s.type === 'domain').slice(0, 5);
      for (const s of targets) {
        usedTools.push('wayback-cdx');
        const url = s.type === 'domain' ? `https://${s.value}` : s.value;
        try {
          const artefacts = await queryWayback(url);
          for (const a of artefacts.slice(0, 8)) {
            pushItem(
              items,
              itemKeys,
              {
                key: `wayback:${a.archiveUrl}`,
                entity: s.value,
                title: `Archive snapshot ${a.timestamp ?? ''}`.trim(),
                source: 'wayback-cdx',
                snippet: a.notes ?? a.archiveUrl,
                url: a.archiveUrl,
                score: 68,
              },
              seen,
            );
          }
        } catch {
          /* best effort */
        }
      }
    }

    // Darkweb / breach
    if (enableDarkweb && opts.darkwebAuth) {
      const dwSeeds = seeds
        .filter(s => ['email', 'username', 'domain', 'person', 'name'].includes(s.type))
        .slice(0, 5);
      for (const s of dwSeeds) {
        usedTools.push('ahmia-index');
        try {
          const mentions = await searchAhmia(s.value, opts.fetchText);
          for (const m of mentions.slice(0, 5)) {
            pushItem(
              items,
              itemKeys,
              {
                key: `ahmia:${m.url || m.title}:${s.value}`,
                entity: s.value,
                title: m.title || 'Ahmia hit',
                source: 'ahmia-index',
                snippet: m.description || m.url,
                url: m.url || m.onionUrl,
                score: 60,
              },
              seen,
            );
          }
        } catch {
          /* best effort */
        }
      }

      const emails = seeds.filter(s => s.type === 'email' || s.value.includes('@')).slice(0, 5);
      if (emails.length) {
        usedTools.push('darkweb-monitor', 'hibp-breach');
        try {
          const report = await monitorDarkWeb(
            emails.map(e => ({ value: e.value, type: 'email' })),
            {
              auth: opts.darkwebAuth,
              breachProvider: createHibpProvider(),
              searchProvider: { id: 'ahmia', search: q => searchAhmia(q, opts.fetchText) },
            },
          );
          for (const r of report.results) {
            for (const b of r.breachData) {
              pushItem(
                items,
                itemKeys,
                {
                  key: `breach:${b.source}:${b.name}:${r.entity}`,
                  entity: r.entity,
                  title: `Breach: ${b.name}`,
                  source: `hibp-breach/${b.source}`,
                  snippet: (b.dataClasses || []).join(', ') || b.name,
                  score: 75,
                },
                seen,
              );
            }
          }
        } catch {
          /* policy or network — skip */
        }

        if (process.env.DEHASHED_API_KEY) {
          usedTools.push('dehashed-breach');
          const dehashed = createDehashedProvider();
          for (const e of emails) {
            for (const b of await dehashed.check(e.value)) {
              pushItem(
                items,
                itemKeys,
                {
                  key: `dehashed:${b.name}:${e.value}`,
                  entity: e.value,
                  title: `DeHashed: ${b.name}`,
                  source: 'dehashed-breach',
                  snippet: b.name,
                  score: 74,
                },
                seen,
              );
            }
          }
        }

        if (process.env.INTELX_API_KEY) {
          usedTools.push('intelx-search');
          for (const e of emails.slice(0, 2)) {
            const settleMs = Number(process.env.OCROWLEY_INTELX_SETTLE_MS || 4000);
            const ix = await searchIntelX(e.value, { settleMs });
            for (const rec of ix.results.slice(0, 5)) {
              pushItem(
                items,
                itemKeys,
                {
                  key: `intelx:${rec.storageid}`,
                  entity: e.value,
                  title: rec.name || 'IntelX record',
                  source: 'intelx-search',
                  snippet: `${rec.bucket} ${rec.date}`,
                  score: 70,
                },
                seen,
              );
            }
          }
        }
      }
    }

    // BigBrother / SpiderFoot / SpiderDash HTTP bridges — await until finished
    if (enableBridges) {
      applyBridgeUrlDefaults();

      const bb = await runBridgeScanAndWait('OCROWLEY_BIGBROTHER_BRIDGE', '/scan', {
        seeds,
        sweepNumber,
        authorizationRef: opts.auth.authorizationRef,
        scanType: 'Passive',
        peopleFocus: true,
        privateUse: true,
      });
      if (bb) {
        usedTools.push('bb-bridge');
        const payload = bb as { items?: OsintEvidenceItem[]; seeds?: RefinementSeed[] };
        for (const item of payload.items ?? []) pushItem(items, itemKeys, item, seen);
        for (const seed of payload.seeds ?? []) discoveredSeeds.push(seed);
      }

      const sf = await runBridgeScanAndWait('OCROWLEY_SPIDERFOOT_URL', '/api/scan', {
        seeds,
        sweepNumber,
        authorizationRef: opts.auth.authorizationRef,
      });
      if (sf) {
        usedTools.push('spiderfoot-scan');
        const payload = sf as {
          items?: OsintEvidenceItem[];
          seeds?: RefinementSeed[];
          results?: OsintEvidenceItem[];
        };
        for (const item of [...(payload.items ?? []), ...(payload.results ?? [])]) {
          pushItem(items, itemKeys, item, seen);
        }
        for (const seed of payload.seeds ?? []) discoveredSeeds.push(seed);
      }

      // SpiderDash / ARCANUM — tRPC scan + poll (defaults to hosted URL)
      const personSeed =
        seeds.find(s => s.type === 'person' || s.type === 'name')?.value ||
        seeds.find(s => s.type === 'email' || s.type === 'username' || s.type === 'domain')?.value;
      if (personSeed) {
        try {
          const dash = await runSpiderdashWhoScan({
            target: personSeed,
            name: `WHO: ${personSeed}`,
            scanType: 'Passive',
            seeds,
            authorizationRef: opts.auth.authorizationRef,
          });
          if (dash) {
            usedTools.push('spiderdash-bridge', 'spiderfoot-scan');
            for (const item of dash.items) pushItem(items, itemKeys, item, seen);
            for (const seed of dash.seeds) discoveredSeeds.push(seed);
          }
        } catch {
          /* best effort */
        }
      }
    }

    // CLI bridges
    for (const s of seeds.filter(x => x.type === 'username').slice(0, 2)) {
      const sherlockOut = await runCliTool(
        'sherlock',
        [s.value, '--print-found', '--no-color', '--timeout', '12'],
        enableCli,
      );
      if (sherlockOut) {
        usedTools.push('cli-sherlock');
        pushItem(
          items,
          itemKeys,
          {
            key: `cli-sherlock:${s.value}:${sweepNumber}`,
            entity: s.value,
            title: 'Sherlock CLI results',
            source: 'cli-sherlock',
            snippet: sherlockOut.slice(0, 500),
            score: 66,
          },
          seen,
        );
        for (const line of sherlockOut.split('\n')) {
          const m = line.match(/\[\+\]\s+(.+?):\s+(https?:\/\/\S+)/);
          if (m) {
            pushItem(
              items,
              itemKeys,
              {
                key: `sherlock:${m[2]}`,
                entity: s.value,
                title: m[1].trim(),
                source: 'cli-sherlock',
                snippet: m[2],
                url: m[2],
                score: 70,
              },
              seen,
            );
          }
        }
      }

      const maigretOut = await runCliTool(
        'maigret',
        [s.value, '--no-color', '--timeout', '8', '-n', '30'],
        enableCli,
      );
      if (maigretOut) {
        usedTools.push('cli-maigret');
        pushItem(
          items,
          itemKeys,
          {
            key: `cli-maigret:${s.value}:${sweepNumber}`,
            entity: s.value,
            title: 'Maigret CLI results',
            source: 'cli-maigret',
            snippet: maigretOut.slice(0, 500),
            score: 66,
          },
          seen,
        );
      }
    }

    for (const s of seeds.filter(x => x.type === 'email').slice(0, 2)) {
      const holeheOut = await runCliTool('holehe', [s.value, '--no-color', '--only-used'], enableCli);
      if (holeheOut) {
        usedTools.push('cli-holehe');
        pushItem(
          items,
          itemKeys,
          {
            key: `cli-holehe:${s.value}:${sweepNumber}`,
            entity: s.value,
            title: 'Holehe CLI results',
            source: 'cli-holehe',
            snippet: holeheOut.slice(0, 500),
            score: 66,
          },
          seen,
        );
      }
    }

    // Dedup entities derived from seeds (bookkeeping evidence)
    usedTools.push('entity-dedup', 'seed-extract');
    const entities: OsintEntity[] = seeds.map((s, i) => ({
      id: `seed-${i}`,
      type: (s.type as OsintEntity['type']) || inferEntityType(s.value),
      value: s.value,
    }));
    const dedup = detectExactDuplicates(entities);
    if (dedup.groups.length) {
      pushItem(
        items,
        itemKeys,
        {
          key: `dedup:${sweepNumber}:${dedup.stats.duplicateGroups}`,
          entity: '*',
          title: `Collapsed ${dedup.stats.duplicateGroups} duplicate groups`,
          source: 'entity-dedup',
          snippet: dedup.groups.map(g => g.canonical).join(', '),
          score: 50,
        },
        seen,
      );
    }

    // Annotate sweep with tool usage (stable key so overlap logic still works)
    pushItem(
      items,
      itemKeys,
      {
        key: `toolkit-meta:${sweepNumber}:${[...new Set(usedTools)].sort().join(',')}`,
        entity: '*',
        title: `Tools used (sweep ${sweepNumber})`,
        source: 'toolkit',
        snippet: [...new Set(usedTools)].join(', ') || 'none',
        score: 10,
      },
      seen,
    );

    return { items, itemKeys, discoveredSeeds };
  };
}

/** Critique enrich path — archive + darkweb + variants for gap-fill. */
export function createFullEnrich(opts: ToolkitOptions) {
  const discover = createFullDiscover(opts);
  return async function enrichFromCritique(
    report: CritiqueReport,
    ctx: { seeds: RefinementSeed[]; evidence: OsintEvidenceItem[] },
  ): Promise<OsintEvidenceItem[]> {
    const extraSeeds: RefinementSeed[] = [...ctx.seeds];
    for (const f of report.flags) {
      if (f.suggestedSeed) {
        extraSeeds.push({
          type: f.suggestedSeed.type,
          value: f.suggestedSeed.value,
          confidence: 70,
          source: 'critique-flag',
        });
      }
    }
    for (const q of report.nextQueries.slice(0, 5)) {
      const type = inferEntityType(q.replace(/^.*\bfor\s+/i, '').trim());
      const value = q.replace(/^.*\bfor\s+/i, '').trim() || q;
      extraSeeds.push({ type, value, confidence: 60, source: 'critique-query' });
    }
    const sweep = await discover(extraSeeds, 100 + report.round);
    const existing = new Set(ctx.evidence.map(e => e.key));
    return sweep.items.filter(i => !existing.has(i.key) && i.source !== 'toolkit');
  };
}
