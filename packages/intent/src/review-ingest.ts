import type { ImprovementBrief, ReviewAnalysis } from './output-contract.js';

const splitLines = (text = '') => text.split(/\n+/).map((line) => line.trim()).filter(Boolean);

export function analyseReviews(reviewText = ''): ReviewAnalysis {
  const lines = splitLines(reviewText);
  const praisedElements: string[] = [];
  const criticisedElements: string[] = [];
  const requestedChanges: string[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/\b(strong|works|good|great|funny|moving|sharp|excellent|love|liked)\b/.test(lower)) praisedElements.push(line);
    if (/\b(slow|weak|confusing|flat|unclear|too long|bloated|repetitive|purple|boring|thin)\b/.test(lower)) criticisedElements.push(line);
    if (/\b(should|needs?|must|cut|add|remove|rewrite|tighten|expand|clarify)\b/.test(lower)) requestedChanges.push(line);
  }

  return {
    praisedElements,
    criticisedElements,
    requestedChanges,
    contradictionsBetweenReviews: findContradictions(praisedElements, criticisedElements),
    nonNegotiables: lines.filter((line) => /\b(do not|don't|must keep|preserve|non-negotiable)\b/i.test(line)),
    suggestedImprovementPriorities: buildPriorities(praisedElements, criticisedElements, requestedChanges),
  };
}

function findContradictions(praise: string[], criticism: string[]) {
  const contradictions: string[] = [];
  const topics = ['dialogue', 'pace', 'pacing', 'voice', 'structure', 'character', 'ending', 'opening', 'tone'];
  for (const topic of topics) {
    if (praise.some((x) => x.toLowerCase().includes(topic)) && criticism.some((x) => x.toLowerCase().includes(topic))) {
      contradictions.push(`Reviews conflict on ${topic}.`);
    }
  }
  return contradictions;
}

function buildPriorities(praise: string[], criticism: string[], requested: string[]) {
  const priorities: string[] = [];
  if (criticism.some((x) => /slow|pacing|too long|bloated/i.test(x))) priorities.push('Improve pacing and cut bloat.');
  if (criticism.some((x) => /dialogue|voice/i.test(x))) priorities.push('Repair dialogue/voice without flattening style.');
  if (criticism.some((x) => /confusing|unclear|structure/i.test(x))) priorities.push('Clarify structure and scene logic.');
  if (praise.some((x) => /dialogue|voice/i.test(x))) priorities.push('Preserve existing dialogue/voice strengths.');
  if (requested.length) priorities.push('Address explicit requested changes first.');
  return Array.from(new Set(priorities));
}

export function buildImprovementBrief(input: Partial<ImprovementBrief>): ImprovementBrief {
  const reviewAnalysis = input.reviewAnalysis || analyseReviews(input.externalReviews || '');
  return {
    manuscriptId: input.manuscriptId,
    userIntent: input.userIntent || 'Improve the manuscript while preserving the authorial voice.',
    selectedImprovementModes: input.selectedImprovementModes?.length ? input.selectedImprovementModes : ['Preserve my voice, only sharpen it'],
    userDiagnosis: input.userDiagnosis || '',
    externalReviews: input.externalReviews || '',
    reviewAnalysis,
    priorityMode: input.priorityMode || 'Balance both',
    nonNegotiables: input.nonNegotiables || reviewAnalysis.nonNegotiables,
    targetOutcome: input.targetOutcome || 'A sharper, cleaner, more effective version of the same work.',
    forbiddenChanges: input.forbiddenChanges || ['Do not replace the user voice with generic AI prose.', 'Do not add purple prose.', 'Do not produce a plan instead of revised text.'],
  };
}

export function improvementBriefToPrompt(brief: ImprovementBrief): string {
  return `IMPROVEMENT BRIEF\nUser intent: ${brief.userIntent}\nModes: ${brief.selectedImprovementModes.join(', ')}\nUser diagnosis: ${brief.userDiagnosis || 'Not supplied'}\nPriority mode: ${brief.priorityMode || 'Balance both'}\nNon-negotiables: ${(brief.nonNegotiables || []).join('; ') || 'None supplied'}\nForbidden changes: ${(brief.forbiddenChanges || []).join('; ')}\nReview priorities: ${(brief.reviewAnalysis?.suggestedImprovementPriorities || []).join('; ') || 'None supplied'}\nPraised elements to preserve: ${(brief.reviewAnalysis?.praisedElements || []).join('; ') || 'None supplied'}\nCriticisms to address: ${(brief.reviewAnalysis?.criticisedElements || []).join('; ') || 'None supplied'}`;
}
