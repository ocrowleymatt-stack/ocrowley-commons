import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  runRefinementLoop,
  extractSeedsFromText,
  deterministicCritique,
  runCritiqueLoop,
  runRecursiveOsint,
  type RefinementSeed,
  type OsintEvidenceItem,
} from '../src/index.js';

const auth = {
  actorId: 'u1',
  roles: ['osint-operator'],
  authorizationRef: 'CASE-LOOP-1',
  purpose: 'authorised passive enrichment',
};

describe('recursive OSINT loops', () => {
  it('extracts deterministic seeds from text', () => {
    const seeds = extractSeedsFromText('Contact jane@example.com or @janedoe — also see https://github.com/janedoe');
    assert.ok(seeds.some(s => s.type === 'email' && s.value === 'jane@example.com'));
    assert.ok(seeds.some(s => s.type === 'username' && s.value === 'janedoe'));
    assert.ok(seeds.some(s => s.type === 'domain' && s.value === 'github.com'));
  });

  it('expands seeds until no-new-refinements', async () => {
    const result = await runRefinementLoop({
      initialSeeds: [{ type: 'username', value: 'alice', confidence: 90, source: 'input' }],
      maxSweeps: 5,
      queryFn: async (seeds, sweep) => {
        const seed = seeds[0];
        if (sweep === 1) {
          return {
            items: [{ n: 1 }],
            itemKeys: ['k1'],
            discoveredSeeds: [
              { type: 'email', value: 'alice@example.com', confidence: 80, source: 'sweep1' },
            ],
          };
        }
        return {
          items: [{ n: sweep, seed: seed.value }],
          itemKeys: [`k${sweep}`],
          discoveredSeeds: [],
        };
      },
    });
    assert.equal(result.convergenceReason, 'no-new-refinements');
    assert.ok(result.allSeeds.some(s => s.type === 'email'));
    assert.ok(result.totalSweeps >= 2);
  });

  it('critique loop improves or plateaus with deterministic scorer', async () => {
    let evidence = 0;
    const out = await runCritiqueLoop({
      maxRounds: 4,
      targetScore: 90,
      plateauEpsilon: 2,
      plateauRounds: 2,
      synthesise: async () => ({
        findings: [
          {
            entity: 'bob',
            keptCount: evidence,
            findings: Array.from({ length: evidence }, (_, i) => ({
              title: `hit-${i}`,
              source: 'test',
              snippet: 'reported mention',
            })),
          },
        ],
        briefText: evidence ? 'reported unverified source note' : '',
        evidenceCount: evidence,
      }),
      critique: deterministicCritique,
      enrich: async () => {
        if (evidence < 3) {
          evidence += 1;
          return { newEvidenceCount: 1 };
        }
        return { newEvidenceCount: 0 };
      },
    });
    assert.ok(out.totalRounds >= 1);
    assert.ok(['target-reached', 'plateau', 'no-new-evidence', 'max-rounds'].includes(out.stopReason));
  });

  it('runs full recursive engine with injected discover adapter', async () => {
    const result = await runRecursiveOsint({
      auth,
      initialSeeds: [{ type: 'username', value: 'carol', confidence: 95, source: 'input' } satisfies RefinementSeed],
      maxDiscoverSweeps: 3,
      maxCritiqueRounds: 3,
      targetScore: 70,
      discover: async (seeds, sweep) => {
        const items: OsintEvidenceItem[] = seeds.map(s => ({
          key: `${s.value}-${sweep}`,
          entity: s.value,
          title: `Profile hint ${sweep}`,
          source: 'stub-probe',
          snippet: sweep === 1 ? `Also listed carol@example.org and @carol_alt` : `reported page for ${s.value}`,
          score: 60 + sweep,
        }));
        return {
          items,
          itemKeys: items.map(i => i.key),
          discoveredSeeds: [],
        };
      },
      enrichFromCritique: async report => {
        const q = report.nextQueries[0];
        if (!q) return [];
        return [
          {
            key: `enrich-${report.round}`,
            entity: 'carol',
            title: 'Archive hit',
            source: 'wayback-stub',
            snippet: 'reported snapshot alleged association',
            score: 72,
          },
        ];
      },
    });

    assert.ok(result.seeds.some(s => s.type === 'email' || s.value.includes('carol')));
    assert.ok(result.evidence.length >= 1);
    assert.equal(result.brief.classification.includes('UNCLASSIFIED'), true);
    assert.ok(result.brief.score >= 0);
  });

  it('denies recursive run without authorization', async () => {
    await assert.rejects(
      () =>
        runRecursiveOsint({
          auth: { ...auth, authorizationRef: '' },
          initialSeeds: [{ type: 'username', value: 'x', confidence: 90, source: 't' }],
          discover: async () => ({ items: [], itemKeys: [], discoveredSeeds: [] }),
        }),
      /policy denied/i,
    );
  });
});
