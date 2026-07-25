/**
 * OSINT analyst prompt builders (no model calls).
 * Source: Hook hooks/basicHooks.js risk_review + export_report.
 */

import { EVIDENTIAL_WARNING, REPORT_CLASSIFICATION } from './types.js';

export interface FindingSnippet {
  title?: string;
  source?: string;
  snippet?: string;
  relevance?: { score?: number; grade?: string };
}

export interface EntityFindings {
  entity: string;
  findings?: FindingSnippet[];
  keptCount?: number;
  rejectedCount?: number;
  queryCount?: number;
}

export function buildRiskReviewSystemPrompt(): string {
  return `You are an intelligence analyst reviewing open-source research findings.
Identify specific evidential risks, gaps, and flags. Be precise and legally cautious.
Return JSON with:
- "risks": array of specific risk strings tied to actual findings
- "flags": array of { entity, issue, source, recommendation }
- "gaps": array of strings describing missing or failed searches
- "overallAssessment": 1-2 sentence summary of research quality
- "confidenceLevel": "high" | "medium" | "low"`;
}

export function buildRiskReviewUserContent(entities: EntityFindings[], mode = 'unknown'): string {
  const findingsSummary = entities
    .map(entity => {
      const topFindings = (entity.findings || [])
        .slice(0, 5)
        .map(
          f =>
            `  - [score:${f.relevance?.score ?? '?'}] ${f.title ?? '(untitled)'} | ${f.source ?? 'unknown'} | "${(f.snippet || '').slice(0, 120)}"`,
        )
        .join('\n');
      return `Entity: ${entity.entity} (kept:${entity.keptCount ?? 0}, rejected:${entity.rejectedCount ?? 0})\n${topFindings}`;
    })
    .join('\n\n');

  return `Review these findings:\n\n${findingsSummary}\n\nMode: ${mode}\nEntities: ${entities.length}`;
}

export function buildOsintBriefSystemPrompt(): string {
  return `You are an intelligence analyst writing a structured OSINT brief.
Write a professional, factual, legally cautious intelligence report.
Use "alleged", "reported", "unverified" language. Never state as fact what is only a lead.
Return JSON with:
- "executiveSummary": string (3-5 sentences)
- "entityProfiles": array of { name, keyFindings: string[], institutionalLinks: string[], geographicLinks: string[], confidenceScore: number, assessmentNotes: string }
- "networkPatterns": string describing connections between entities
- "priorityLeads": array of 3-5 actionable follow-up items
- "evidentialWarnings": array of strings
- "reportClassification": "${REPORT_CLASSIFICATION}"`;
}

export function buildOsintBriefUserContent(
  entities: EntityFindings[],
  risks: string[] = [],
  flags: Array<{ entity: string; issue: string; recommendation?: string }> = [],
  mode = 'unknown',
): string {
  const entitySummaries = entities
    .map(entity => {
      const topFindings = (entity.findings || [])
        .slice(0, 8)
        .map(
          f =>
            `  Source: ${f.source ?? 'unknown'}\n  Title: ${f.title ?? '(untitled)'}\n  Snippet: ${(f.snippet || '').slice(0, 200)}\n  Score: ${f.relevance?.score ?? '?'} | Grade: ${f.relevance?.grade ?? '?'}`,
        )
        .join('\n\n');
      return `### ${entity.entity}\nQueries: ${entity.queryCount ?? 0} | Kept: ${entity.keptCount ?? 0} | Rejected: ${entity.rejectedCount ?? 0}\n\n${topFindings}`;
    })
    .join('\n\n---\n\n');

  const riskSummary = [
    ...risks.map(r => `- ${r}`),
    ...flags.map(f => `- FLAG [${f.entity}]: ${f.issue} (${f.recommendation ?? ''})`),
  ].join('\n');

  return `Research findings:\n${entitySummaries}\n\nRisk review:\n${riskSummary}\n\nMode: ${mode}\nGenerated: ${new Date().toISOString()}`;
}

export function staticRiskReviewFallback(): {
  risks: string[];
  flags: [];
  gaps: [];
  overallAssessment: string;
  confidenceLevel: 'low';
  analysisMethod: 'fallback_static';
  evidentialWarning: string;
} {
  return {
    risks: [
      'Check every factual assertion against primary evidence',
      'Do not blur allegation and established fact',
      'Preserve uncertainty and contradictions',
      'Avoid overclaiming causation or intent',
    ],
    flags: [],
    gaps: [],
    overallAssessment: 'AI risk review unavailable — manual review required.',
    confidenceLevel: 'low',
    analysisMethod: 'fallback_static',
    evidentialWarning: EVIDENTIAL_WARNING,
  };
}
