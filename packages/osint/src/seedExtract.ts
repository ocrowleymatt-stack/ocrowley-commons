/**
 * Deterministic identifier extraction from free text / finding blobs.
 * Used when no LLM extractor is injected — keeps recursion useful offline.
 */

import { looksLikeDomain, looksLikeEmail, looksLikeIpv4 } from './normalize.js';
import type { RefinementSeed } from './refinementLoop.js';

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL_RE = /\bhttps?:\/\/[^\s"'<>]+/gi;
const ONION_RE = /\b[a-z2-7]{16,56}\.onion\b/gi;
const HANDLE_RE = /(?:^|[\s"'(:])@([A-Za-z0-9_]{3,32})\b/g;
const PHONE_RE = /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}\b/g;

function asText(item: unknown): string {
  if (typeof item === 'string') return item;
  try {
    return JSON.stringify(item);
  } catch {
    return String(item);
  }
}

export function extractSeedsFromText(
  text: string,
  source = 'deterministic-extract',
  baseConfidence = 70,
): RefinementSeed[] {
  const seeds: RefinementSeed[] = [];

  for (const m of text.match(EMAIL_RE) ?? []) {
    if (looksLikeEmail(m)) {
      seeds.push({ type: 'email', value: m.toLowerCase(), confidence: baseConfidence + 10, source });
    }
  }

  for (const m of text.match(URL_RE) ?? []) {
    try {
      const host = new URL(m).hostname.replace(/^www\./, '');
      if (looksLikeDomain(host) || looksLikeIpv4(host)) {
        seeds.push({
          type: looksLikeIpv4(host) ? 'ip' : 'domain',
          value: host.toLowerCase(),
          confidence: baseConfidence,
          source,
        });
      }
      seeds.push({ type: 'url', value: m.split(/[#?]/)[0], confidence: baseConfidence - 5, source });
    } catch {
      /* ignore bad urls */
    }
  }

  for (const m of text.match(ONION_RE) ?? []) {
    seeds.push({ type: 'onion', value: m.toLowerCase(), confidence: baseConfidence, source });
  }

  let handle: RegExpExecArray | null;
  const handleRe = new RegExp(HANDLE_RE.source, 'g');
  while ((handle = handleRe.exec(text)) !== null) {
    seeds.push({ type: 'username', value: handle[1], confidence: baseConfidence - 10, source });
  }

  for (const m of text.match(PHONE_RE) ?? []) {
    const digits = m.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 15) {
      seeds.push({ type: 'phone', value: m.trim(), confidence: baseConfidence - 15, source });
    }
  }

  return seeds;
}

export function extractSeedsFromItems(
  items: unknown[],
  existing: RefinementSeed[],
  source = 'deterministic-extract',
): RefinementSeed[] {
  const existingKeys = new Set(existing.map(s => `${s.type}:${s.value.toLowerCase().trim()}`));
  const found: RefinementSeed[] = [];
  for (const item of items) {
    for (const seed of extractSeedsFromText(asText(item), source)) {
      const key = `${seed.type}:${seed.value.toLowerCase().trim()}`;
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        found.push(seed);
      }
    }
  }
  return found;
}

/** Prompt for host LLM extractors — structured seed discovery. */
export function buildSeedExtractionPrompt(
  itemsSummary: string,
  existingSeeds: RefinementSeed[],
  contextLabel: string,
): { system: string; user: string } {
  return {
    system:
      'You are an OSINT analyst. Extract new actionable identifiers from the provided data. ' +
      'Only return identifiers NOT already in the existing seed list. ' +
      'Be conservative — only include high-confidence identifiers. ' +
      'Return JSON: { "seeds": [{"type","value","confidence","source"}], "converged": boolean }.',
    user:
      `Context: ${contextLabel}\n\n` +
      `Existing seeds (do NOT repeat): ${existingSeeds.map(s => `${s.type}: ${s.value}`).join(', ')}\n\n` +
      `New data:\n${itemsSummary.slice(0, 4000)}`,
  };
}
