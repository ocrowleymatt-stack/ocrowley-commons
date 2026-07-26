/**
 * Catalogue of every OSINT tool the recursive engine can invoke.
 * Live = implemented in commons; bridge = optional external runtime; catalog-only = registered for hosts.
 */

export type ToolRuntime = 'live' | 'bridge' | 'optional-dep';

export interface ToolSpec {
  id: string;
  family: 'commons' | 'darkweb' | 'bigbrother' | 'spiderfoot' | 'cli';
  description: string;
  seedTypes: string[];
  passive: boolean;
  runtime: ToolRuntime;
  env?: string[];
}

export const TOOL_CATALOG: ToolSpec[] = [
  // Commons live
  {
    id: 'platform-probe',
    family: 'commons',
    description: 'HTTP HEAD username probes across default social/dev platforms',
    seedTypes: ['username'],
    passive: true,
    runtime: 'live',
  },
  {
    id: 'username-variants',
    family: 'commons',
    description: 'Generate username variants from person name seeds',
    seedTypes: ['person', 'name'],
    passive: true,
    runtime: 'live',
  },
  {
    id: 'wayback-cdx',
    family: 'commons',
    description: 'Internet Archive CDX snapshot recovery',
    seedTypes: ['url', 'domain'],
    passive: true,
    runtime: 'live',
  },
  {
    id: 'seed-extract',
    family: 'commons',
    description: 'Deterministic identifier harvest from findings',
    seedTypes: ['*'],
    passive: true,
    runtime: 'live',
  },
  {
    id: 'entity-dedup',
    family: 'commons',
    description: 'Exact-match entity alias collapse',
    seedTypes: ['*'],
    passive: true,
    runtime: 'live',
  },
  {
    id: 'geo-cluster',
    family: 'commons',
    description: 'Cluster geocoded location seeds (host geocoder optional)',
    seedTypes: ['location', 'address'],
    passive: true,
    runtime: 'live',
  },
  {
    id: 'find-person',
    family: 'commons',
    description: 'People-first pack: seeds, profiles, UK records links, recursive enrich',
    seedTypes: ['person', 'name', 'email', 'username', 'phone'],
    passive: true,
    runtime: 'live',
  },
  {
    id: 'companies-house',
    family: 'commons',
    description: 'UK Companies House officer search',
    seedTypes: ['person', 'name'],
    passive: true,
    runtime: 'live',
    env: ['COMPANIES_HOUSE_API_KEY'],
  },
  // Darkweb live (gated)
  {
    id: 'ahmia-index',
    family: 'darkweb',
    description: 'Ahmia clearnet Tor-index search',
    seedTypes: ['email', 'username', 'domain', 'person', 'name'],
    passive: true,
    runtime: 'live',
  },
  {
    id: 'hibp-breach',
    family: 'darkweb',
    description: 'Have I Been Pwned breach check',
    seedTypes: ['email'],
    passive: true,
    runtime: 'live',
    env: ['HIBP_API_KEY'],
  },
  {
    id: 'dehashed-breach',
    family: 'darkweb',
    description: 'DeHashed breach search',
    seedTypes: ['email', 'username'],
    passive: true,
    runtime: 'live',
    env: ['DEHASHED_EMAIL', 'DEHASHED_API_KEY'],
  },
  {
    id: 'intelx-search',
    family: 'darkweb',
    description: 'Intelligence X search',
    seedTypes: ['email', 'username', 'domain', 'ip'],
    passive: true,
    runtime: 'live',
    env: ['INTELX_API_KEY'],
  },
  {
    id: 'darkweb-monitor',
    family: 'darkweb',
    description: 'Multi-entity dark-web index + breach monitor',
    seedTypes: ['email', 'username', 'domain'],
    passive: true,
    runtime: 'live',
  },
  // TheBigBrother modules (optional Python dep / bridge)
  ...([
    ['bb-phantom-id', 'phantom_id', 'Username enumeration across platforms', ['username'], true],
    ['bb-digital-footprint', 'digital_footprint', 'Email/phone footprint helpers', ['email', 'phone'], true],
    ['bb-dark-watch', 'dark_watch', 'Dark-web watch module', ['email', 'username', 'domain'], true],
    ['bb-breach-vault', 'breach_vault', 'Breach vault lookups', ['email'], true],
    ['bb-wayback-spectre', 'wayback_spectre', 'Wayback spectre archive module', ['url', 'domain'], true],
    ['bb-domain-oracle', 'domain_oracle', 'Domain intelligence', ['domain'], true],
    ['bb-ssl-sentinel', 'ssl_sentinel', 'SSL/TLS intelligence', ['domain'], true],
    ['bb-network-mapper', 'network_mapper', 'Network reconnaissance', ['domain', 'ip'], false],
    ['bb-geoint-spy', 'geoint_spy', 'Geoint helpers', ['location', 'address'], true],
    ['bb-exif-analyzer', 'exif_analyzer', 'EXIF extraction', ['url'], true],
    ['bb-crypto-analyzer', 'crypto_analyzer', 'Crypto wallet analysis', ['crypto'], true],
    ['bb-mail-tracer', 'mail_tracer', 'Mail / email tracing helpers', ['email'], true],
    ['bb-paste-dragnet', 'paste_dragnet', 'Paste-site dragnet', ['email', 'username'], true],
    ['bb-dork-studio', 'dork_studio', 'Search dork builder', ['person', 'domain', 'username'], true],
    ['bb-code-hunter', 'code_hunter', 'Code/repo hunter', ['username', 'email'], true],
    ['bb-shadow-map', 'shadow_map', 'Shadow mapping', ['username', 'domain'], true],
    ['bb-sigint-sweep', 'sigint_sweep', 'SIGINT-style sweep helpers', ['phone', 'username'], false],
    ['bb-flight-radar', 'flight_radar', 'Flight radar module', ['person'], true],
    ['bb-ai-analyst', 'ai_analyst', 'AI analyst module', ['*'], true],
  ] as const).map(
    ([id, _mod, description, seedTypes, passive]) =>
      ({
        id,
        family: 'bigbrother' as const,
        description: `${description} (the_big_brother.${_mod})`,
        seedTypes: [...seedTypes],
        passive,
        runtime: 'optional-dep' as const,
        env: ['OCROWLEY_BIGBROTHER_BRIDGE', 'PYTHONPATH'],
      }) satisfies ToolSpec,
  ),
  // SpiderFoot / CLI bridges
  {
    id: 'spiderfoot-scan',
    family: 'spiderfoot',
    description: 'SpiderFoot scan via HTTP API bridge',
    seedTypes: ['domain', 'ip', 'email', 'person', 'phone', 'username'],
    passive: true,
    runtime: 'bridge',
    env: ['OCROWLEY_SPIDERFOOT_URL', 'OCROWLEY_SPIDERFOOT_USER', 'OCROWLEY_SPIDERFOOT_PASS'],
  },
  {
    id: 'cli-maigret',
    family: 'cli',
    description: 'maigret username CLI bridge',
    seedTypes: ['username'],
    passive: true,
    runtime: 'bridge',
    env: ['OCROWLEY_ENABLE_CLI_TOOLS'],
  },
  {
    id: 'cli-sherlock',
    family: 'cli',
    description: 'sherlock username CLI bridge',
    seedTypes: ['username'],
    passive: true,
    runtime: 'bridge',
    env: ['OCROWLEY_ENABLE_CLI_TOOLS'],
  },
  {
    id: 'cli-holehe',
    family: 'cli',
    description: 'holehe email CLI bridge',
    seedTypes: ['email'],
    passive: true,
    runtime: 'bridge',
    env: ['OCROWLEY_ENABLE_CLI_TOOLS'],
  },
];

export function listTools(filter?: {
  family?: ToolSpec['family'];
  runtime?: ToolRuntime;
  passiveOnly?: boolean;
}): ToolSpec[] {
  return TOOL_CATALOG.filter(t => {
    if (filter?.family && t.family !== filter.family) return false;
    if (filter?.runtime && t.runtime !== filter.runtime) return false;
    if (filter?.passiveOnly && !t.passive) return false;
    return true;
  });
}

export function toolStatus(tool: ToolSpec): { id: string; ready: boolean; reason: string } {
  if (tool.runtime === 'live') return { id: tool.id, ready: true, reason: 'in-process' };
  const missing = (tool.env ?? []).filter(e => !process.env[e]);
  if (tool.runtime === 'bridge' || tool.runtime === 'optional-dep') {
    if (missing.length) return { id: tool.id, ready: false, reason: `missing env: ${missing.join(', ')}` };
    return { id: tool.id, ready: true, reason: 'bridge configured' };
  }
  return { id: tool.id, ready: false, reason: 'unknown' };
}
