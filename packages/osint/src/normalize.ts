/**
 * Target / entity normalisation helpers.
 * Source: spiderfoot-ui server/spiderfoot.ts targetTypeFromString patterns.
 */

import type { EntityType } from './types.js';

export function normalizeEntityValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9@._+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function looksLikeDomain(value: string): boolean {
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(value.trim());
}

export function looksLikeIpv4(value: string): boolean {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value.trim());
}

export function looksLikeUrl(value: string): boolean {
  try {
    const u = new URL(value.startsWith('http') ? value : `https://${value}`);
    return Boolean(u.hostname);
  } catch {
    return false;
  }
}

export function inferEntityType(value: string): EntityType {
  const v = value.trim();
  if (looksLikeEmail(v)) return 'email';
  if (looksLikeIpv4(v)) return 'ip';
  if (looksLikeUrl(v) && (v.includes('/') || v.startsWith('http'))) return 'url';
  if (looksLikeDomain(v)) return 'domain';
  if (/^\+?[\d\s().-]{7,}$/.test(v)) return 'phone';
  if (/^[a-z0-9_.-]{2,32}$/i.test(v) && !v.includes(' ')) return 'username';
  if (/\s/.test(v)) return 'person';
  return 'unknown';
}

/**
 * SpiderFoot's targetTypeFromString requires human names wrapped in quotes.
 */
export function normalizeSpiderfootTarget(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (looksLikeEmail(trimmed) || looksLikeDomain(trimmed) || looksLikeIpv4(trimmed) || looksLikeUrl(trimmed)) {
    return trimmed;
  }
  if (/\s/.test(trimmed) && !trimmed.startsWith('"')) {
    return `"${trimmed.replace(/"/g, '')}"`;
  }
  return trimmed;
}

export function buildUsernameVariants(firstName: string, lastName: string): string[] {
  const f = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const l = lastName.toLowerCase().replace(/[^a-z]/g, '');
  if (!f || !l) return [];
  return [
    `${f}${l}`,
    `${f}.${l}`,
    `${f}_${l}`,
    `${f}-${l}`,
    `${f}${l[0]}`,
    `${f[0]}${l}`,
    `${f[0]}.${l}`,
    `${f[0]}_${l}`,
  ].filter((v, i, a) => a.indexOf(v) === i);
}
