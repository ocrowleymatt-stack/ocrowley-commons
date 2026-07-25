/**
 * Core literary prompt builders.
 * Source: Caspa/Shakespeare AIService standing patterns + AGENTS.md directives.
 */

export const LITERARY_SYSTEM = `You are a literary engine. Story first, style second.
Concrete before abstract. Subtext over declaration. Every scene must turn.
Never overwrite. Prefer objects, gestures, weather, silence, behaviour.
Cut filler. Avoid emotion labels. Make endings inevitable but surprising.`;

export function outlinePrompt(premise: string, genre: string, chapters: number): string {
  return [
    `Genre: ${genre}`,
    `Target chapters: ${chapters}`,
    `Premise: ${premise}`,
    '',
    'Produce a chapter-by-chapter outline. Each chapter needs:',
    '- title',
    '- dramatic turn (what changes)',
    '- pressure on the protagonist',
    '- ending image',
    'Do not write full prose. Plans only.',
  ].join('\n');
}

export function scenePrompt(opts: {
  premise: string;
  chapterTitle: string;
  beat: string;
  priorSummary?: string;
  styleNotes?: string;
}): string {
  return [
    `Chapter: ${opts.chapterTitle}`,
    `Beat: ${opts.beat}`,
    opts.priorSummary ? `Prior: ${opts.priorSummary}` : '',
    opts.styleNotes ? `Voice: ${opts.styleNotes}` : '',
    `Premise spine: ${opts.premise}`,
    '',
    'Write the scene as finished prose. Output artefact first, not a plan.',
    'Show behaviour. Let dialogue carry conflict. End on an image or turn.',
  ].filter(Boolean).join('\n');
}

export function critiquePrompt(excerpt: string, mode: string = 'novel'): string {
  return [
    `Mode: ${mode}`,
    'Diagnose this excerpt. List concrete faults with line evidence.',
    'Focus on: filler, passive drift, missing turn, declared emotion, echo.',
    'Then propose a tightened rewrite of the weakest paragraph only.',
    '',
    excerpt,
  ].join('\n');
}

export function cutPrompt(excerpt: string, targetReduction = 0.3): string {
  return [
    `Cut ~${Math.round(targetReduction * 100)}% without losing meaning or voice.`,
    'Remove bloat, repetition, ornament, and explanation.',
    'Return revised text only.',
    '',
    excerpt,
  ].join('\n');
}
