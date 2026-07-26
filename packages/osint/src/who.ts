/**
 * People lookup — one string in, report out.
 *
 *   const r = await who('Jane Doe at Acme in Manchester')
 *   console.log(r.text)   // printable
 *   console.log(r.next)   // best URL to open next
 */

import { createHibpProvider, searchAhmia } from '@ocrowley/darkweb';
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
import { searchCompaniesHouseOfficers } from './ukRecords.js';
import { EVIDENTIAL_WARNING, REPORT_CLASSIFICATION, type PlatformProbe } from './types.js';

/** High-signal platforms first — fewer probes, better hit rate. */
const PEOPLE_PLATFORMS: PlatformProbe[] = [
  ...DEFAULT_USERNAME_PLATFORMS.filter(p =>
    ['GitHub', 'Twitter/X', 'Instagram', 'Reddit', 'LinkedIn', 'TikTok', 'Keybase', 'Medium', 'GitLab', 'YouTube'].includes(
      p.site,
    ),
  ),
];

export interface WhoHints {
  at?: string;
  in?: string;
  email?: string;
  username?: string;
  phone?: string;
  aka?: string | string[];
  country?: 'uk' | 'us' | 'other';
  case?: string;
  /** Ahmia + breach paths when keys/env allow */
  deep?: boolean;
}

export interface WhoHit {
  kind: 'profile' | 'record' | 'breach' | 'darkweb' | 'gravatar' | 'email' | 'archive';
  title: string;
  detail: string;
  url?: string;
  confidence: 'confirmed' | 'likely' | 'possible';
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

  // "Jane Doe Manchester" — last Capitalised token as location if no `in`
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
): string {
  const lines: string[] = [];
  lines.push(`WHO: ${name}`);
  lines.push(REPORT_CLASSIFICATION);
  lines.push(`${stats.confirmed} confirmed · ${stats.likely} likely · ${stats.possible} possible · ${stats.checked} checked`);
  lines.push('');
  lines.push(`NEXT → ${next}`);
  lines.push('');

  const bucket = (label: string, conf: WhoHit['confidence'], max = 20) => {
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
  bucket('POSSIBLE', 'possible', 10);

  if (!hits.length) {
    lines.push('No live hits yet — open NEXT and work the list below.');
    lines.push('');
  }

  lines.push('MORE');
  for (const l of open.slice(0, 6)) {
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

/**
 * Look someone up.
 *
 * @example
 * await who('Jane Doe')
 * await who('Jane Doe at Acme in Manchester')
 * await who('jane@acme.com')
 * await who('@janedoe')
 * await who('Jane Doe', { deep: true, case: 'CASE-42' })
 */
export async function who(input: string, hints: WhoHints = {}): Promise<WhoResult> {
  if (!input?.trim()) throw new Error('who(input): pass a name, email, @username, or "Name at Org in City"');

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
  const uniqueVariants = [...new Set(variants)].slice(0, 6);

  const emails = [
    ...(query.email ? [query.email] : []),
    ...seeds.filter(s => s.type === 'email' && s.confidence >= 90).map(s => s.value),
    ...guessEmailPatterns(first, last, employerDomains(query.employer)),
  ];
  const uniqueEmails = [...new Set(emails.filter(looksLikeEmail))].slice(0, 6);

  const deep =
    hints.deep === true ||
    process.env.OCROWLEY_OSINT_DEEP === '1' ||
    process.env.OCROWLEY_OSINT_LAWFUL === '1';

  const hits: WhoHit[] = [];
  let checked = 0;

  // Fan-out: profiles + emails + companies house + linkedin + deep — in parallel
  const [profileHits, emailBundles, officers, linkedinPresence, darkMentions] = await Promise.all([
    probePeopleUsernames(uniqueVariants, {
      maxUsernames: 6,
      concurrency: 12,
      platforms: PEOPLE_PLATFORMS,
      parallelUsernames: true,
    }).then(r => {
      checked += uniqueVariants.length * PEOPLE_PLATFORMS.length;
      return r;
    }),

    Promise.all(
      uniqueEmails.map(async email => {
        checked += 1;
        const grav = await probeGravatar(email);
        let breaches: Array<{ name: string; dataClasses?: string[] }> = [];
        if (process.env.HIBP_API_KEY) {
          checked += 1;
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
            try {
              return await searchAhmia(term as string);
            } catch {
              return [];
            }
          }),
        ).then(lists => lists.flat())
      : Promise.resolve([]),
  ]);

  for (const p of profileHits) {
    hits.push({
      kind: 'profile',
      title: `${p.site} · @${p.username}`,
      detail: 'Live profile',
      url: p.url,
      confidence: 'confirmed',
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
      });
    } else if (provided) {
      hits.push({
        kind: 'email',
        title: `Email · ${email}`,
        detail: 'Provided (delivery not verified)',
        confidence: 'likely',
      });
    }
    for (const b of breaches.slice(0, 8)) {
      hits.push({
        kind: 'breach',
        title: `Breach · ${b.name}`,
        detail: (b.dataClasses || []).slice(0, 6).join(', ') || email,
        confidence: 'confirmed',
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
    });
  }

  if (linkedinPresence?.ok) {
    hits.push({
      kind: 'profile',
      title: `LinkedIn · ${linkedinPresence.slug}`,
      detail: 'Profile URL responded',
      url: linkedinPresence.url,
      confidence: 'likely',
    });
  }

  for (const m of darkMentions.slice(0, 5)) {
    hits.push({
      kind: 'darkweb',
      title: m.title || 'Ahmia mention',
      detail: m.description || displayName,
      url: m.url || m.onionUrl,
      confidence: 'possible',
    });
  }

  // Wayback on top confirmed profile URLs (archive corroboration)
  const topUrls = hits.filter(h => h.confidence === 'confirmed' && h.url).slice(0, 3);
  if (topUrls.length) {
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
  const stats = {
    confirmed: deduped.filter(h => h.confidence === 'confirmed').length,
    likely: deduped.filter(h => h.confidence === 'likely').length,
    possible: deduped.filter(h => h.confidence === 'possible').length,
    checked,
  };

  return {
    q: input.trim(),
    name: displayName,
    hits: deduped,
    next,
    open,
    stats,
    text: formatReport(displayName, deduped, next, open, stats),
    warning: EVIDENTIAL_WARNING,
  };
}

export async function whoText(input: string, hints?: WhoHints): Promise<string> {
  return (await who(input, hints)).text;
}
