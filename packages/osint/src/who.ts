/**
 * People lookup — one string in, report out.
 *
 *   const r = await who('Jane Doe at Acme in Manchester')
 *   console.log(r.text)   // printable
 *   console.log(r.next)   // best URL to open next
 *
 * By default runs the full toolkit (platforms, archive, darkweb when keyed,
 * SpiderFoot/BigBrother/SpiderDash bridges with await-until-done, optional CLIs)
 * plus fast people probes. Prefer who() over findPerson for the product path.
 */

import { createHibpProvider, searchAhmia, type DarkwebAuthorization } from '@ocrowley/darkweb';
import { queryWayback } from './archive.js';
import { looksLikeEmail, inferEntityType } from './normalize.js';
import {
  buildPersonSearchLinks,
  buildPersonSeeds,
  buildPersonUsernameVariants,
  guessEmailPatterns,
  type PersonQuery,
  type PersonSearchLink,
} from './people.js';
import { DEFAULT_USERNAME_PLATFORMS } from './platforms.js';
import { assertOsintAllowed, type OsintAuthorization } from './policy.js';
import { probeGravatar, probePeopleUsernames, probeUrlPresence } from './probeBetter.js';
import {
  runRecursiveOsint,
  type OsintEvidenceItem,
  type RecursiveOsintResult,
} from './recursiveEngine.js';
import { createFullDiscover, createFullEnrich, reportToolkitAvailability } from './toolkit.js';
import { searchCompaniesHouseOfficers } from './ukRecords.js';
import { archiveWhoResult } from './whoArchive.js';
import { applyBridgeUrlDefaults } from './bridgeDefaults.js';
import { EVIDENTIAL_WARNING, REPORT_CLASSIFICATION, type PlatformProbe } from './types.js';

/** All catalogued platforms for maximum coverage. */
const PEOPLE_PLATFORMS: PlatformProbe[] = [...DEFAULT_USERNAME_PLATFORMS];

export interface WhoHints {
  at?: string;
  in?: string;
  email?: string;
  username?: string;
  phone?: string;
  aka?: string | string[];
  country?: 'uk' | 'us' | 'other';
  case?: string;
  /** Ahmia + breach paths when keys/env allow (also implied by full). */
  deep?: boolean;
  /**
   * Use every available tool via recursive discover + critique.
   * Default true. Pass false for fast probes-only.
   */
  full?: boolean;
  /** Persist result under data/who-archive (default true). */
  archive?: boolean;
  maxDiscoverSweeps?: number;
  maxCritiqueRounds?: number;
  enableCliTools?: boolean;
}

export interface WhoHit {
  kind: 'profile' | 'record' | 'breach' | 'darkweb' | 'gravatar' | 'email' | 'archive' | 'tool';
  title: string;
  detail: string;
  url?: string;
  confidence: 'confirmed' | 'likely' | 'possible';
  source?: string;
}

export interface WhoResult {
  q: string;
  name: string;
  hits: WhoHit[];
  /** Single best URL to open next */
  next: string;
  open: PersonSearchLink[];
  stats: { confirmed: number; likely: number; possible: number; checked: number };
  text: string;
  warning: string;
  toolsUsed: string[];
  toolsReady: Array<{ id: string; ready: boolean; reason: string; family: string }>;
  archiveId?: string;
  recursive?: {
    score: number;
    sweeps: number;
    evidenceCount: number;
    stopReason: string;
  };
}

function defaultAuth(caseRef?: string): OsintAuthorization {
  return {
    actorId: process.env.OCROWLEY_OSINT_ACTOR || 'local',
    roles: ['osint-operator'],
    authorizationRef: caseRef || process.env.OCROWLEY_OSINT_CASE || 'local-dev',
    purpose: process.env.OCROWLEY_OSINT_PURPOSE || 'authorised people research',
    environment: (process.env.NODE_ENV as OsintAuthorization['environment']) || 'development',
  };
}

/** Pull at/in/email/@user out of free text so the caller rarely needs hints. */
export function parseWhoInput(input: string, hints: WhoHints = {}): PersonQuery {
  let text = input.trim();
  let email = hints.email;
  let username = hints.username?.replace(/^@/, '');
  let employer = hints.at;
  let location = hints.in;
  let phone = hints.phone;

  const emailMatch = text.match(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/);
  if (emailMatch) {
    email = email || emailMatch[0];
    text = text.replace(emailMatch[0], ' ').trim();
  }

  const atOrg = text.match(/\bat\s+([^,]+?)(?=\s+in\s+|\s+aka\s+|$)/i);
  if (atOrg && !employer) {
    employer = atOrg[1].trim();
    text = text.replace(atOrg[0], ' ').trim();
  }

  const inLoc = text.match(/\bin\s+([^,]+?)(?=\s+at\s+|\s+aka\s+|$)/i);
  if (inLoc && !location) {
    location = inLoc[1].trim();
    text = text.replace(inLoc[0], ' ').trim();
  }

  const akaMatch = text.match(/\baka\s+([^,]+)$/i);
  let aliases = hints.aka ? (Array.isArray(hints.aka) ? hints.aka : [hints.aka]) : undefined;
  if (akaMatch) {
    aliases = [...(aliases || []), akaMatch[1].trim()];
    text = text.replace(akaMatch[0], ' ').trim();
  }

  const handle = text.match(/(?:^|\s)@([A-Za-z0-9_]{2,32})\b/);
  if (handle && !username) {
    username = handle[1];
    text = text.replace(handle[0], ' ').trim();
  }

  text = text.replace(/\s+/g, ' ').trim();
  const type = inferEntityType(text);

  if ((!text || type === 'email') && email) {
    return { email, username, phone, employer, location, aliases, country: hints.country ?? 'uk' };
  }
  if (type === 'username' && !text.includes(' ')) {
    return {
      username: text.replace(/^@/, ''),
      email,
      phone,
      employer,
      location,
      aliases,
      country: hints.country ?? 'uk',
    };
  }
  if (type === 'phone') {
    return { phone: text, email, username, employer, location, aliases, country: hints.country ?? 'uk' };
  }

  const parts = text.split(/\s+/).filter(Boolean);
  let name = text;
  if (!location && parts.length >= 3) {
    const maybeLoc = parts[parts.length - 1];
    if (/^[A-Z][a-z]+$/.test(maybeLoc) || /shire|ton|pool|chester|mouth|ford|burg|city/i.test(maybeLoc)) {
      location = maybeLoc;
      name = parts.slice(0, -1).join(' ');
    }
  }

  return {
    name: name || undefined,
    email,
    username,
    phone,
    employer,
    location,
    aliases,
    country: hints.country ?? 'uk',
  };
}

function employerDomains(employer?: string): string[] {
  if (!employer) return [];
  const slug = employer
    .toLowerCase()
    .replace(/\b(ltd|limited|plc|inc|corp|corporation|llc|the|group|uk)\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
  if (!slug || slug.length < 2) return [];
  return [`${slug}.com`, `${slug}.co.uk`, `${slug}.io`];
}

function formatReport(
  name: string,
  hits: WhoHit[],
  next: string,
  open: PersonSearchLink[],
  stats: WhoResult['stats'],
  toolsUsed: string[],
): string {
  const lines: string[] = [];
  lines.push(`WHO: ${name}`);
  lines.push(REPORT_CLASSIFICATION);
  lines.push(`${stats.confirmed} confirmed · ${stats.likely} likely · ${stats.possible} possible · ${stats.checked} checked`);
  if (toolsUsed.length) {
    lines.push(`TOOLS · ${toolsUsed.slice(0, 24).join(', ')}${toolsUsed.length > 24 ? '…' : ''}`);
  }
  lines.push('');
  lines.push(`NEXT → ${next}`);
  lines.push('');

  const bucket = (label: string, conf: WhoHit['confidence'], max = 24) => {
    const list = hits.filter(h => h.confidence === conf).slice(0, max);
    if (!list.length) return;
    lines.push(label);
    for (const h of list) {
      lines.push(`  • ${h.title}${h.url ? `\n    ${h.url}` : ''}`);
      if (h.detail && conf === 'confirmed') lines.push(`    ${h.detail}`);
    }
    lines.push('');
  };

  bucket('CONFIRMED', 'confirmed');
  bucket('LIKELY', 'likely');
  bucket('POSSIBLE', 'possible', 16);

  if (!hits.length) {
    lines.push('No live hits yet — open NEXT and work the list below.');
    lines.push('');
  }

  lines.push('MORE');
  for (const l of open.slice(0, 8)) {
    lines.push(`  → ${l.engine}: ${l.label}`);
    lines.push(`    ${l.url}`);
  }
  lines.push('');
  lines.push(EVIDENTIAL_WARNING);
  return lines.join('\n');
}

function pickNext(hits: WhoHit[], open: PersonSearchLink[]): string {
  const confirmed = hits.find(h => h.confidence === 'confirmed' && h.url);
  if (confirmed?.url) return confirmed.url;
  const likely = hits.find(h => h.confidence === 'likely' && h.url);
  if (likely?.url) return likely.url;
  const records = open.find(l => l.category === 'records');
  if (records) return records.url;
  const social = open.find(l => l.engine === 'LinkedIn');
  if (social) return social.url;
  return open[0]?.url || 'https://www.google.com';
}

function confidenceFromScore(score?: number): WhoHit['confidence'] {
  if ((score ?? 0) >= 75) return 'confirmed';
  if ((score ?? 0) >= 55) return 'likely';
  return 'possible';
}

function kindFromEvidence(item: OsintEvidenceItem): WhoHit['kind'] {
  const s = item.source || '';
  if (s.includes('platform') || s.includes('profile') || s.includes('sherlock') || s.includes('maigret')) {
    return 'profile';
  }
  if (s.includes('breach') || s.includes('hibp') || s.includes('dehashed')) return 'breach';
  if (s.includes('ahmia') || s.includes('dark')) return 'darkweb';
  if (s.includes('wayback') || s.includes('archive')) return 'archive';
  if (s.includes('companies-house') || s.includes('record')) return 'record';
  if (s.includes('gravatar') || item.entity.includes('@')) return item.url ? 'gravatar' : 'email';
  if (s === 'toolkit' || item.entity === '*') return 'tool';
  return 'record';
}

function mergeEvidenceHits(hits: WhoHit[], evidence: OsintEvidenceItem[]): void {
  for (const item of evidence) {
    if (item.entity === '*' && item.source === 'toolkit') continue;
    if (item.source === 'person-search-links') continue;
    hits.push({
      kind: kindFromEvidence(item),
      title: item.title,
      detail: item.snippet || item.source,
      url: item.url,
      confidence: confidenceFromScore(item.score),
      source: item.source,
    });
  }
}

function extractToolsUsed(evidence: OsintEvidenceItem[], extra: string[]): string[] {
  const set = new Set<string>(extra);
  for (const item of evidence) {
    if (item.source === 'toolkit' && item.snippet) {
      for (const t of item.snippet.split(',').map(s => s.trim()).filter(Boolean)) set.add(t);
    } else if (item.source && item.source !== 'toolkit') {
      set.add(item.source);
    }
  }
  return [...set].sort();
}

/**
 * Look someone up — full toolkit by default.
 *
 * @example
 * await who('Jane Doe')
 * await who('Jane Doe at Acme in Manchester')
 * await who('jane@acme.com')
 * await who('@janedoe')
 * await who('Jane Doe', { deep: true, case: 'CASE-42' })
 * await who('Jane Doe', { full: false }) // fast probes only
 */
export async function who(input: string, hints: WhoHints = {}): Promise<WhoResult> {
  if (!input?.trim()) throw new Error('who(input): pass a name, email, @username, or "Name at Org in City"');

  applyBridgeUrlDefaults();

  const auth = defaultAuth(hints.case);
  assertOsintAllowed('enrich.person', auth);

  const query = parseWhoInput(input, hints);
  const seeds = buildPersonSeeds(query);
  const displayName =
    query.name ||
    (query.firstName && query.lastName ? `${query.firstName} ${query.lastName}` : '') ||
    query.username ||
    query.email ||
    input.trim();

  const nameParts = (query.name || displayName).split(/\s+/).filter(Boolean);
  const first = query.firstName || nameParts[0] || '';
  const last = query.lastName || (nameParts.length > 1 ? nameParts[nameParts.length - 1] : '');
  const variants = [
    ...(query.username ? [query.username.replace(/^@/, '')] : []),
    ...buildPersonUsernameVariants(first, last, query.aliases),
  ].filter(Boolean);
  const uniqueVariants = [...new Set(variants)].slice(0, 8);

  const emails = [
    ...(query.email ? [query.email] : []),
    ...seeds.filter(s => s.type === 'email' && s.confidence >= 90).map(s => s.value),
    ...guessEmailPatterns(first, last, employerDomains(query.employer)),
  ];
  const uniqueEmails = [...new Set(emails.filter(looksLikeEmail))].slice(0, 8);

  const full =
    hints.full !== false &&
    process.env.OCROWLEY_OSINT_QUICK !== '1';
  const deep =
    hints.deep === true ||
    full ||
    process.env.OCROWLEY_OSINT_DEEP === '1' ||
    process.env.OCROWLEY_OSINT_LAWFUL === '1';

  const darkwebAuth: DarkwebAuthorization | undefined = deep
    ? {
        actorId: auth.actorId,
        roles: auth.roles,
        authorizationRef: auth.authorizationRef,
        purpose: auth.purpose,
        environment: auth.environment,
        lawfulUseAcknowledged: true,
      }
    : undefined;

  const hits: WhoHit[] = [];
  let checked = 0;
  const baseToolsUsed: string[] = ['username-variants', 'person-search-links'];

  // Fast people probes (strong GET + soft-404) run in parallel with full toolkit
  const fastProbes = Promise.all([
    probePeopleUsernames(uniqueVariants, {
      maxUsernames: 8,
      concurrency: 12,
      platforms: PEOPLE_PLATFORMS,
      parallelUsernames: true,
    }).then(r => {
      checked += uniqueVariants.length * PEOPLE_PLATFORMS.length;
      baseToolsUsed.push('platform-probe');
      return r;
    }),

    Promise.all(
      uniqueEmails.map(async email => {
        checked += 1;
        baseToolsUsed.push('gravatar');
        const grav = await probeGravatar(email);
        let breaches: Array<{ name: string; dataClasses?: string[] }> = [];
        if (process.env.HIBP_API_KEY) {
          checked += 1;
          baseToolsUsed.push('hibp-breach');
          try {
            breaches = await createHibpProvider().check(email);
          } catch {
            /* ignore */
          }
        }
        return { email, grav, breaches };
      }),
    ),

    (query.country ?? 'uk') === 'uk' && displayName.includes(' ')
      ? searchCompaniesHouseOfficers(displayName).then(r => {
          checked += 1;
          baseToolsUsed.push('companies-house');
          return r;
        })
      : Promise.resolve([]),

    first && last
      ? (() => {
          const slug = `${first}-${last}`.toLowerCase().replace(/[^a-z-]/g, '');
          const url = `https://www.linkedin.com/in/${slug}`;
          checked += 1;
          return probeUrlPresence(url).then(p => ({ url, slug, ok: p.ok }));
        })()
      : Promise.resolve(null),

    deep
      ? Promise.all(
          [displayName, query.email].filter(Boolean).slice(0, 2).map(async term => {
            checked += 1;
            baseToolsUsed.push('ahmia-index');
            try {
              return await searchAhmia(term as string);
            } catch {
              return [];
            }
          }),
        ).then(lists => lists.flat())
      : Promise.resolve([]),
  ]);

  let recursive: RecursiveOsintResult | undefined;
  const toolkitOpts = {
    auth,
    darkwebAuth,
    enableDarkweb: Boolean(darkwebAuth?.lawfulUseAcknowledged),
    enableArchive: true,
    enablePlatformProbes: true,
    enableBridges: true,
    enableCliTools: hints.enableCliTools === true || process.env.OCROWLEY_ENABLE_CLI_TOOLS === '1',
    maxUsernamesPerSweep: 8,
  };

  const toolsReport = reportToolkitAvailability(toolkitOpts);

  const recursivePromise = full
    ? (async () => {
        const discover = createFullDiscover(toolkitOpts);
        const enrichFromCritique = createFullEnrich(toolkitOpts);
        const openLinks = buildPersonSearchLinks(query, displayName);
        const peopleDiscover = async (
          activeSeeds: typeof seeds,
          sweep: number,
        ) => {
          const base = await discover(activeSeeds, sweep);
          if (sweep === 1) {
            for (const link of openLinks.slice(0, 12)) {
              base.items.push({
                key: `searchlink:${link.engine}:${link.label}`,
                entity: displayName,
                title: `${link.engine}: ${link.label}`,
                source: 'person-search-links',
                snippet: link.url,
                url: link.url,
                score: 40,
              });
              base.itemKeys.push(`searchlink:${link.engine}:${link.label}`);
            }
          }
          return base;
        };
        return runRecursiveOsint({
          auth,
          initialSeeds: seeds,
          discover: peopleDiscover,
          enrichFromCritique,
          toolkit: toolkitOpts,
          useFullToolkit: false,
          maxDiscoverSweeps: hints.maxDiscoverSweeps ?? Number(process.env.OCROWLEY_WHO_SWEEPS || 5),
          maxCritiqueRounds: hints.maxCritiqueRounds ?? Number(process.env.OCROWLEY_WHO_CRITIQUE || 3),
          targetScore: Number(process.env.OCROWLEY_WHO_TARGET_SCORE || 78),
        });
      })()
    : Promise.resolve(undefined);

  const [[profileHits, emailBundles, officers, linkedinPresence, darkMentions], recursiveResult] =
    await Promise.all([fastProbes, recursivePromise]);
  recursive = recursiveResult;

  for (const p of profileHits) {
    hits.push({
      kind: 'profile',
      title: `${p.site} · @${p.username}`,
      detail: 'Live profile',
      url: p.url,
      confidence: 'confirmed',
      source: 'platform-probe',
    });
  }

  for (const { email, grav, breaches } of emailBundles) {
    const provided = query.email === email || seeds.some(s => s.value === email && s.source === 'query');
    if (grav?.found) {
      hits.push({
        kind: 'gravatar',
        title: `Gravatar · ${email}`,
        detail: provided ? 'Avatar registered' : 'Guessed work email + avatar',
        url: grav.url,
        confidence: 'confirmed',
        source: 'gravatar',
      });
    } else if (provided) {
      hits.push({
        kind: 'email',
        title: `Email · ${email}`,
        detail: 'Provided (delivery not verified)',
        confidence: 'likely',
        source: 'query',
      });
    }
    for (const b of breaches.slice(0, 8)) {
      hits.push({
        kind: 'breach',
        title: `Breach · ${b.name}`,
        detail: (b.dataClasses || []).slice(0, 6).join(', ') || email,
        confidence: 'confirmed',
        source: 'hibp-breach',
      });
    }
  }

  for (const o of officers.slice(0, 6)) {
    hits.push({
      kind: 'record',
      title: `Companies House · ${o.title}`,
      detail: o.companyName || 'Officer match',
      url: o.url,
      confidence: process.env.COMPANIES_HOUSE_API_KEY ? 'confirmed' : 'possible',
      source: 'companies-house',
    });
  }

  if (linkedinPresence?.ok) {
    hits.push({
      kind: 'profile',
      title: `LinkedIn · ${linkedinPresence.slug}`,
      detail: 'Profile URL responded',
      url: linkedinPresence.url,
      confidence: 'likely',
      source: 'linkedin-slug',
    });
  }

  for (const m of darkMentions.slice(0, 5)) {
    hits.push({
      kind: 'darkweb',
      title: m.title || 'Ahmia mention',
      detail: m.description || displayName,
      url: m.url || m.onionUrl,
      confidence: 'possible',
      source: 'ahmia-index',
    });
  }

  if (recursive?.evidence?.length) {
    mergeEvidenceHits(hits, recursive.evidence);
    checked += recursive.evidence.length;
  }

  // Wayback on top confirmed profile URLs
  const topUrls = hits.filter(h => h.confidence === 'confirmed' && h.url).slice(0, 4);
  if (topUrls.length) {
    baseToolsUsed.push('wayback-cdx');
    const archives = await Promise.all(
      topUrls.map(async h => {
        checked += 1;
        try {
          const arts = await queryWayback(h.url!);
          return arts[0] ? { hit: h, art: arts[0] } : null;
        } catch {
          return null;
        }
      }),
    );
    for (const a of archives) {
      if (!a) continue;
      hits.push({
        kind: 'archive',
        title: `Wayback · ${a.hit.title}`,
        detail: a.art.timestamp ? `Snapshot ${a.art.timestamp}` : 'Archived copy',
        url: a.art.archiveUrl,
        confidence: 'likely',
        source: 'wayback-cdx',
      });
    }
  }

  const seen = new Set<string>();
  const deduped = hits.filter(h => {
    const k = `${h.kind}:${h.title}:${h.url || ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const open = buildPersonSearchLinks(query, displayName).sort((a, b) => {
    const rank = (c: string) =>
      ({ records: 0, social: 1, web: 2, news: 3, images: 4, code: 5, breach: 6 })[c] ?? 9;
    return rank(a.category) - rank(b.category);
  });

  const next = pickNext(deduped, open);
  const toolsUsed = extractToolsUsed(recursive?.evidence || [], baseToolsUsed);
  const stats = {
    confirmed: deduped.filter(h => h.confidence === 'confirmed').length,
    likely: deduped.filter(h => h.confidence === 'likely').length,
    possible: deduped.filter(h => h.confidence === 'possible').length,
    checked,
  };

  const result: WhoResult = {
    q: input.trim(),
    name: displayName,
    hits: deduped,
    next,
    open,
    stats,
    text: formatReport(displayName, deduped, next, open, stats, toolsUsed),
    warning: EVIDENTIAL_WARNING,
    toolsUsed,
    toolsReady: toolsReport.tools,
    recursive: recursive
      ? {
          score: recursive.brief.score,
          sweeps: recursive.discovery.totalSweeps,
          evidenceCount: recursive.evidence.length,
          stopReason: recursive.brief.stopReason,
        }
      : undefined,
  };

  const shouldArchive = hints.archive !== false && process.env.OCROWLEY_WHO_ARCHIVE !== '0';
  if (shouldArchive) {
    try {
      const entry = await archiveWhoResult(result, auth.authorizationRef);
      result.archiveId = entry.id;
    } catch {
      /* best-effort archive */
    }
  }

  return result;
}

export async function whoText(input: string, hints?: WhoHints): Promise<string> {
  return (await who(input, hints)).text;
}
