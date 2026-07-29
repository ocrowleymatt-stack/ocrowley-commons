/**
 * Evidence entry guardrails (generalized from Hook annexX/guardrails).
 */
export type EvidenceGuardrailInput = {
  id?: string;
  createdAt?: string;
  observedFact?: string;
  legalRelevance?: string;
  sourceTrace?: unknown[];
  inference?: string;
  cautions?: unknown[];
  confidence?: number;
  classification?: string[];
};

export type GuardrailResult = {
  passed: boolean;
  blocked: boolean;
  issues: string[];
};

const DEFAULT_ALLOWED = ['observed_fact', 'documentary', 'testimonial', 'digital', 'other'];

export function runEvidenceGuardrails(
  entry: EvidenceGuardrailInput,
  opts: { minConfidence?: number; allowedClassifications?: string[] } = {},
): GuardrailResult {
  const minConfidence = opts.minConfidence ?? 0.65;
  const allowed = opts.allowedClassifications ?? DEFAULT_ALLOWED;
  const issues: string[] = [];

  if (!entry.id) issues.push('Entry has no id');
  if (!entry.createdAt) issues.push('Entry has no createdAt timestamp');
  if (!entry.observedFact || entry.observedFact.trim().length < 10) {
    issues.push('Observed fact is missing or too thin');
  }
  if (!entry.legalRelevance || entry.legalRelevance.trim().length < 10) {
    issues.push('Legal relevance is missing or too thin');
  }
  if (!entry.sourceTrace?.length) issues.push('No source trace supplied');
  if (entry.inference && !entry.cautions?.length) {
    issues.push('Inference provided without caution/limitation note');
  }
  const confidence = entry.confidence ?? NaN;
  if (Number.isNaN(confidence) || confidence < 0 || confidence > 1) {
    issues.push('Confidence must be between 0 and 1');
  } else if (confidence < minConfidence) {
    issues.push('Confidence below litigation-safe threshold');
  }
  for (const c of entry.classification ?? []) {
    if (!allowed.includes(c)) issues.push(`Unknown classification: ${c}`);
  }

  const blocked = issues.some((i) =>
    /no id|no createdAt|missing or too thin|No source trace|Confidence must/i.test(i),
  );
  return { passed: issues.length === 0, blocked, issues };
}
