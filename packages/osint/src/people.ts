/**
 * People-first OSINT — easy API, strong enrichment.
 * Sources: spiderfoot-ui person-enrichment.ts + recursive toolkit.
 *
 * One call: findPerson({ name, ... }) → structured person pack.
 */

import type { DarkwebAuthorization } from '@ocrowley/darkweb';
import { buildUsernameVariants, looksLikeEmail, normalizeEntityValue } from './normalize.js';
import { DEFAULT_USERNAME_PLATFORMS, probeUsernamePlatforms, resolvePlatformUrl } from './platforms.js';
import { assertOsintAllowed, type OsintAuthorization } from './policy.js';
import {
  runRecursiveOsint,
  type OsintEvidenceItem,
  type RecursiveOsintOptions,
  type RecursiveOsintResult,
} from './recursiveEngine.js';
import type { RefinementSeed } from './refinementLoop.js';
import { createFullDiscover, createFullEnrich, type ToolkitOptions } from './toolkit.js';
import { EVIDENTIAL_WARNING, REPORT_CLASSIFICATION, type SocialProfile } from './types.js';
import { searchCompaniesHouseOfficers } from './ukRecords.js';

export interface PersonQuery {
  /** Full name, e.g. "Jane Doe" — required unless username or email given. */
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  username?: string;
  phone?: string;
  employer?: string;
  location?: string;
  /** Extra free-text context (aliases, old surnames). */
  aliases?: string[];
  country?: 'uk' | 'us' | 'other';
}

export interface PersonSearchLink {
  engine: string;
  label: string;
  url: string;
  category: 'web' | 'social' | 'records' | 'images' | 'news' | 'code' | 'breach';
}

export interface PersonPack {
  query: PersonQuery;
  displayName: string;
  seeds: RefinementSeed[];
  profiles: SocialProfile[];
  emails: string[];
  usernames: string[];
  phones: string[];
  searchLinks: PersonSearchLink[];
  evidence: OsintEvidenceItem[];
  recursive: RecursiveOsintResult;
  summary: {
    confirmedProfiles: number;
    inferredProfiles: number;
    evidenceCount: number;
    score: number;
    topLeads: string[];
  };
  classification: string;
  evidentialWarning: string;
}

function splitName(query: PersonQuery): { firstName: string; lastName: string; displayName: string } {
  if (query.firstName && query.lastName) {
    return {
      firstName: query.firstName.trim(),
      lastName: query.lastName.trim(),
      displayName: `${query.firstName.trim()} ${query.lastName.trim()}`,
    };
  }
  const raw = (query.name || '').trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return {
      firstName: parts[0],
      lastName: parts[parts.length - 1],
      displayName: raw,
    };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '', displayName: parts[0] };
  }
  if (query.username) return { firstName: '', lastName: '', displayName: query.username };
  if (query.email) return { firstName: '', lastName: '', displayName: query.email };
  return { firstName: '', lastName: '', displayName: 'unknown' };
}

/** Richer username variants for people search. */
export function buildPersonUsernameVariants(firstName: string, lastName: string, aliases: string[] = []): string[] {
  const base = buildUsernameVariants(firstName, lastName);
  const f = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const l = lastName.toLowerCase().replace(/[^a-z]/g, '');
  const extra: string[] = [];
  if (f && l) {
    extra.push(`${f}${l}1`, `${f}.${l}1`, `${l}${f}`, `${l}.${f}`, `${f}${l}${new Date().getFullYear().toString().slice(2)}`);
    // drop year-based guess — too noisy; keep surname-first only
    extra.pop();
  }
  for (const a of aliases) {
    const ap = a.trim().split(/\s+/);
    if (ap.length >= 2) extra.push(...buildUsernameVariants(ap[0], ap[ap.length - 1]));
    else if (ap[0]) extra.push(ap[0].toLowerCase().replace(/[^a-z0-9]/g, ''));
  }
  return [...new Set([...base, ...extra].filter(Boolean))];
}

/** Common email pattern guesses (not verified). */
export function guessEmailPatterns(firstName: string, lastName: string, domains: string[] = []): string[] {
  const f = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const l = lastName.toLowerCase().replace(/[^a-z]/g, '');
  if (!f || !l) return [];
  const locals = [`${f}.${l}`, `${f}${l}`, `${f[0]}${l}`, `${f}_${l}`, `${l}.${f}`];
  const doms = domains.length ? domains : [];
  const out: string[] = [];
  for (const d of doms) {
    for (const local of locals) out.push(`${local}@${d.replace(/^@/, '')}`);
  }
  return out;
}

export function buildPersonSearchLinks(query: PersonQuery, displayName: string): PersonSearchLink[] {
  const q = encodeURIComponent(displayName);
  const employer = query.employer ? encodeURIComponent(query.employer) : '';
  const location = query.location ? encodeURIComponent(query.location) : '';
  const links: PersonSearchLink[] = [
    {
      engine: 'Google',
      label: 'Web search',
      url: `https://www.google.com/search?q=${q}`,
      category: 'web',
    },
    {
      engine: 'Google',
      label: 'Quoted name',
      url: `https://www.google.com/search?q=%22${q}%22`,
      category: 'web',
    },
    {
      engine: 'Google',
      label: 'Name + email/contact dorks',
      url: `https://www.google.com/search?q=%22${q}%22+(email|contact|cv|resume|linkedin)`,
      category: 'web',
    },
    {
      engine: 'DuckDuckGo',
      label: 'Web search',
      url: `https://duckduckgo.com/?q=${q}`,
      category: 'web',
    },
    {
      engine: 'LinkedIn',
      label: 'People search',
      url: `https://www.linkedin.com/search/results/people/?keywords=${q}`,
      category: 'social',
    },
    {
      engine: 'Facebook',
      label: 'People search',
      url: `https://www.facebook.com/search/people/?q=${q}`,
      category: 'social',
    },
    {
      engine: 'X/Twitter',
      label: 'People search',
      url: `https://x.com/search?q=${q}&f=user`,
      category: 'social',
    },
    {
      engine: 'Google Images',
      label: 'Image search',
      url: `https://www.google.com/search?tbm=isch&q=${q}`,
      category: 'images',
    },
    {
      engine: 'Yandex Images',
      label: 'Reverse-friendly image search',
      url: `https://yandex.com/images/search?text=${q}`,
      category: 'images',
    },
    {
      engine: 'Google News',
      label: 'News',
      url: `https://news.google.com/search?q=${q}`,
      category: 'news',
    },
    {
      engine: 'GitHub',
      label: 'Code / people',
      url: `https://github.com/search?q=${q}&type=users`,
      category: 'code',
    },
    {
      engine: 'Have I Been Pwned',
      label: 'Breach check (needs email)',
      url: 'https://haveibeenpwned.com/',
      category: 'breach',
    },
  ];

  if (employer) {
    links.push({
      engine: 'Google',
      label: 'Name + employer',
      url: `https://www.google.com/search?q=%22${q}%22+${employer}`,
      category: 'web',
    });
  }
  if (location) {
    links.push({
      engine: 'Google',
      label: 'Name + location',
      url: `https://www.google.com/search?q=%22${q}%22+${location}`,
      category: 'web',
    });
  }

  const uk = !query.country || query.country === 'uk';
  if (uk) {
    links.push(
      {
        engine: 'Companies House',
        label: 'Officer search',
        url: `https://find-and-update.company-information.service.gov.uk/search/officers?q=${q}`,
        category: 'records',
      },
      {
        engine: 'The Gazette',
        label: 'Notices search',
        url: `https://www.thegazette.co.uk/all-notices/notice?text=${q}`,
        category: 'records',
      },
      {
        engine: 'UK Electoral / address hints',
        label: '192.com search',
        url: `https://www.192.com/people/search/?name=${q}${location ? `&location=${location}` : ''}`,
        category: 'records',
      },
    );
  }

  if (query.email && looksLikeEmail(query.email)) {
    links.push({
      engine: 'Have I Been Pwned',
      label: `Breach check ${query.email}`,
      url: `https://haveibeenpwned.com/account/${encodeURIComponent(query.email)}`,
      category: 'breach',
    });
  }

  return links;
}

export function buildPersonSeeds(query: PersonQuery): RefinementSeed[] {
  const { firstName, lastName, displayName } = splitName(query);
  const seeds: RefinementSeed[] = [];
  const push = (type: string, value: string, confidence: number, source: string) => {
    const v = value.trim();
    if (!v) return;
    seeds.push({ type, value: v, confidence, source });
  };

  if (displayName && displayName !== 'unknown') push('person', displayName, 95, 'query');
  if (firstName && lastName) push('name', `${firstName} ${lastName}`, 95, 'query');

  if (query.email) push('email', query.email.toLowerCase(), 98, 'query');
  if (query.username) push('username', query.username.replace(/^@/, ''), 95, 'query');
  if (query.phone) push('phone', query.phone, 90, 'query');
  if (query.employer) {
    push('organisation', query.employer, 80, 'query');
    const domainGuess = query.employer.toLowerCase().replace(/[^a-z0-9]+/g, '') + '.com';
    push('domain', domainGuess, 40, 'employer-guess');
  }
  if (query.location) push('location', query.location, 70, 'query');

  for (const a of query.aliases ?? []) push('person', a, 75, 'alias');

  const variants = buildPersonUsernameVariants(firstName, lastName, query.aliases);
  for (const u of variants.slice(0, 12)) push('username', u, 62, 'username-variant');

  if (query.employer) {
    const domain = normalizeEntityValue(query.employer).replace(/\s+/g, '') + '.com';
    for (const email of guessEmailPatterns(firstName, lastName, [domain]).slice(0, 4)) {
      push('email', email, 45, 'email-pattern-guess');
    }
  }

  // Dedup
  const seen = new Set<string>();
  return seeds.filter(s => {
    const k = `${s.type}:${s.value.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function probePersonProfiles(usernames: string[], maxUsernames = 6): Promise<SocialProfile[]> {
  const profiles: SocialProfile[] = [];
  for (const username of usernames.slice(0, maxUsernames)) {
    const hit = await probeUsernamePlatforms(username);
    for (const f of hit.found) {
      profiles.push({
        platform: f.site,
        url: f.url,
        username,
        confirmed: true,
      });
    }
  }
  // Inferred LinkedIn from first successful naming pattern
  if (usernames[0]) {
    const slug = usernames.find(u => u.includes('.')) || usernames[0];
    const linkedin = `https://www.linkedin.com/in/${slug.replace(/\./g, '-')}`;
    if (!profiles.some(p => p.platform === 'LinkedIn')) {
      profiles.push({
        platform: 'LinkedIn',
        url: linkedin,
        username: slug,
        confirmed: false,
      });
    }
  }
  return profiles;
}

function extractTyped(evidence: OsintEvidenceItem[], seeds: RefinementSeed[]) {
  const emails = new Set<string>();
  const usernames = new Set<string>();
  const phones = new Set<string>();
  for (const s of seeds) {
    if (s.type === 'email') emails.add(s.value.toLowerCase());
    if (s.type === 'username') usernames.add(s.value);
    if (s.type === 'phone') phones.add(s.value);
  }
  for (const e of evidence) {
    if (e.entity.includes('@')) emails.add(e.entity.toLowerCase());
    if (e.source === 'platform-probe') usernames.add(e.entity);
  }
  return {
    emails: [...emails],
    usernames: [...usernames],
    phones: [...phones],
  };
}

export interface FindPersonOptions {
  auth: OsintAuthorization;
  darkwebAuth?: DarkwebAuthorization;
  toolkit?: Omit<ToolkitOptions, 'auth'>;
  /** Override recursive options. */
  recursive?: Partial<RecursiveOsintOptions>;
  maxUsernameProbes?: number;
  /** Skip network probes; return seeds + search links only (instant). */
  linksOnly?: boolean;
}

/**
 * Easy entry point: find information about a person.
 *
 * @example
 * const pack = await findPerson(
 *   { name: 'Jane Doe', employer: 'Example Ltd', location: 'Manchester' },
 *   { auth: { actorId: 'matt', roles: ['osint-operator'], authorizationRef: 'CASE-1', purpose: 'research' } }
 * );
 */
export async function findPerson(query: PersonQuery, opts: FindPersonOptions): Promise<PersonPack> {
  assertOsintAllowed('enrich.person', opts.auth);

  const { firstName, lastName, displayName } = splitName(query);
  if (displayName === 'unknown') {
    throw new Error('Provide at least a name, username, or email');
  }

  const seeds = buildPersonSeeds(query);
  const searchLinks = buildPersonSearchLinks(query, displayName);

  if (opts.linksOnly) {
    const usernames = seeds.filter(s => s.type === 'username').map(s => s.value);
    const inferred: SocialProfile[] = usernames.slice(0, 3).flatMap(u =>
      DEFAULT_USERNAME_PLATFORMS.slice(0, 5).map(p => ({
        platform: p.site,
        url: resolvePlatformUrl(p, u),
        username: u,
        confirmed: false,
      })),
    );
    return {
      query,
      displayName,
      seeds,
      profiles: inferred,
      emails: seeds.filter(s => s.type === 'email').map(s => s.value),
      usernames,
      phones: seeds.filter(s => s.type === 'phone').map(s => s.value),
      searchLinks,
      evidence: [],
      recursive: {
        discovery: {
          sweeps: [],
          allItems: [],
          allSeeds: seeds,
          convergenceReason: 'max-sweeps',
          totalSweeps: 0,
          totalDurationMs: 0,
        },
        critique: { rounds: [], finalScore: 0, stopReason: 'max-rounds', totalRounds: 0 },
        evidence: [],
        seeds,
        findings: [],
        tools: { tools: [], liveCount: 0, bridgeReadyCount: 0 },
        brief: {
          title: 'Person search links',
          classification: REPORT_CLASSIFICATION,
          executiveSummary: `Link pack for ${displayName}`,
          evidentialWarning: EVIDENTIAL_WARNING,
          score: 0,
          stopReason: 'links-only',
        },
      },
      summary: {
        confirmedProfiles: 0,
        inferredProfiles: inferred.length,
        evidenceCount: 0,
        score: 0,
        topLeads: searchLinks.slice(0, 5).map(l => l.label),
      },
      classification: REPORT_CLASSIFICATION,
      evidentialWarning: EVIDENTIAL_WARNING,
    };
  }

  const toolkitOpts: ToolkitOptions = {
    auth: opts.auth,
    darkwebAuth: opts.darkwebAuth,
    enableDarkweb: Boolean(opts.darkwebAuth?.lawfulUseAcknowledged),
    enableArchive: true,
    enablePlatformProbes: true,
    enableBridges: true,
    ...opts.toolkit,
  };

  const usernameSeeds = seeds.filter(s => s.type === 'username').map(s => s.value);
  const profiles = await probePersonProfiles(usernameSeeds, opts.maxUsernameProbes ?? 6);

  const discover = createFullDiscover(toolkitOpts);
  const enrichFromCritique = createFullEnrich(toolkitOpts);

  // People-weighted discover: also emit search-link evidence + profile hits
  const peopleDiscover = async (activeSeeds: RefinementSeed[], sweep: number) => {
    const base = await discover(activeSeeds, sweep);
    if (sweep === 1) {
      for (const link of searchLinks.slice(0, 12)) {
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
      for (const p of profiles.filter(x => x.confirmed)) {
        base.items.push({
          key: `profile:${p.url}`,
          entity: p.username,
          title: `${p.platform} (confirmed)`,
          source: 'person-profile-probe',
          snippet: p.url,
          url: p.url,
          score: 80,
        });
        base.itemKeys.push(`profile:${p.url}`);
      }
      if (!query.country || query.country === 'uk') {
        try {
          const officers = await searchCompaniesHouseOfficers(displayName);
          for (const o of officers) {
            base.items.push({
              key: `ch:${o.title}:${o.companyNumber || o.companyName || ''}`,
              entity: displayName,
              title: `Companies House: ${o.title}`,
              source: 'companies-house',
              snippet: o.companyName || o.title,
              url: o.url,
              score: 74,
            });
            base.itemKeys.push(`ch:${o.title}:${o.companyNumber || o.companyName || ''}`);
          }
        } catch {
          /* optional */
        }
      }
    }
    return base;
  };

  const recursive = await runRecursiveOsint({
    ...opts.recursive,
    auth: opts.auth,
    initialSeeds: seeds,
    discover: peopleDiscover,
    enrichFromCritique,
    toolkit: toolkitOpts,
    useFullToolkit: false, // using our wrapped discover
    maxDiscoverSweeps: opts.recursive?.maxDiscoverSweeps ?? 5,
    maxCritiqueRounds: opts.recursive?.maxCritiqueRounds ?? 3,
    targetScore: opts.recursive?.targetScore ?? 78,
  });

  const typed = extractTyped(recursive.evidence, recursive.seeds);
  const confirmed = profiles.filter(p => p.confirmed).length;
  const topLeads = [
    ...profiles.filter(p => p.confirmed).slice(0, 3).map(p => `${p.platform}: ${p.url}`),
    ...typed.emails.slice(0, 2).map(e => `email: ${e}`),
    ...searchLinks.filter(l => l.category === 'records').slice(0, 2).map(l => l.label),
  ];

  return {
    query: { ...query, firstName: firstName || query.firstName, lastName: lastName || query.lastName },
    displayName,
    seeds,
    profiles,
    emails: typed.emails,
    usernames: typed.usernames,
    phones: typed.phones,
    searchLinks,
    evidence: recursive.evidence,
    recursive,
    summary: {
      confirmedProfiles: confirmed,
      inferredProfiles: profiles.length - confirmed,
      evidenceCount: recursive.evidence.length,
      score: recursive.brief.score,
      topLeads,
    },
    classification: REPORT_CLASSIFICATION,
    evidentialWarning: EVIDENTIAL_WARNING,
  };
}
