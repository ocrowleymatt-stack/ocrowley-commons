import type { InputType, RequestedAction, RequestedOutput, OutputMode, OutputRoutingDecision } from './output-contract.js';

const manuscriptSignals = [/\bchapter\b/i, /\bscene\b/i, /\bdialogue\b/i, /\bparagraph\b/i, /\bprologue\b/i, /\bact\s+[ivx0-9]+\b/i, /[“”\"]/];
const planSignals = [/\boutline\b/i, /\bbeats?\b/i, /\bbeat sheet\b/i, /\bchapter plan\b/i, /\bsynopsis\b/i, /\btreatment\b/i, /\bcharacter bible\b/i, /\bact structure\b/i];
const researchSignals = [/\bsource\b/i, /\bresearch\b/i, /\bnotes\b/i, /\btranscript\b/i, /\bextract\b/i, /\bfinding\b/i];

export function detectInputType(content = '', command = ''): InputType {
  const text = `${command}\n${content}`.trim();
  if (!text) return 'COMMAND_ONLY';

  const manuscriptScore = manuscriptSignals.filter((rx) => rx.test(text)).length + (text.length > 1800 ? 1 : 0);
  const planScore = planSignals.filter((rx) => rx.test(text)).length;
  const researchScore = researchSignals.filter((rx) => rx.test(text)).length;

  if (manuscriptScore > 1 && planScore > 0) return 'MIXED';
  if (/\bplay treatment\b/i.test(text)) return 'PLAY_TREATMENT';
  if (/\bscript treatment\b/i.test(text)) return 'SCRIPT_TREATMENT';
  if (planScore >= 2) return 'BOOK_PLAN';
  if (manuscriptScore >= 2) return 'MANUSCRIPT_DRAFT';
  if (researchScore >= 2) return 'RESEARCH_NOTES';
  return text.length > 600 ? 'SOURCE_MATERIAL' : 'COMMAND_ONLY';
}

export function detectRequestedAction(command = ''): RequestedAction {
  const c = command.toLowerCase();
  if (/\b(gold|gold pass|prize pass)\b/.test(c)) return 'GOLD_PASS';
  if (/\b(red pen|critique|diagnose|faults?)\b/.test(c)) return 'RED_PEN';
  if (/\b(cut|compress|tighten|shorten|reduce|trim|leaner)\b/.test(c)) return 'CUT';
  if (/\b(polish|line edit|sharpen|improve|make better)\b/.test(c)) return 'POLISH';
  if (/\b(repair|fix|restructure)\b/.test(c)) return 'REPAIR';
  if (/\b(rewrite)\b/.test(c)) return 'REWRITE';
  if (/\b(expand|develop|extend)\b/.test(c)) return 'EXPAND';
  if (/\b(continue|carry on|next page|next scene)\b/.test(c)) return 'CONTINUE';
  if (/\b(plan|outline|beat sheet|book bible)\b/.test(c)) return 'MAKE_PLAN';
  if (/\b(summary|summarise|summarize)\b/.test(c)) return 'SUMMARISE';
  if (/\b(export|pdf|markdown|pack)\b/.test(c)) return 'EXPORT';
  if (/\b(play|stage script|stage)\b/.test(c)) return 'WRITE_PLAY';
  if (/\b(script|screenplay)\b/.test(c)) return 'WRITE_SCRIPT';
  if (/\b(chapter)\b/.test(c)) return 'WRITE_CHAPTER';
  if (/\b(scene)\b/.test(c)) return 'WRITE_SCENE';
  if (/\b(write|draft|make|produce|turn this into)\b/.test(c)) return 'WRITE_BOOK';
  return 'CONTINUE';
}

export function inferRequestedOutput(action: RequestedAction, command = ''): RequestedOutput {
  const c = command.toLowerCase();
  if (/pitch pack/.test(c)) return 'PITCH_PACK';
  if (/query letter/.test(c)) return 'QUERY_LETTER';
  if (/rehearsal pack/.test(c)) return 'REHEARSAL_PACK';
  if (/research brief/.test(c)) return 'RESEARCH_BRIEF';
  if (/synopsis/.test(c)) return 'SYNOPSIS';
  if (/treatment/.test(c)) return 'TREATMENT';
  if (/character bible/.test(c)) return 'CHARACTER_BIBLE';
  if (action === 'CUT' || action === 'COMPRESS') return 'CUT_TEXT';
  if (['POLISH', 'REWRITE', 'REPAIR', 'GOLD_PASS'].includes(action)) return 'POLISHED_TEXT';
  if (action === 'MAKE_PLAN') return 'PLAN';
  if (action === 'WRITE_PLAY') return /full/.test(c) ? 'FULL_PLAY' : 'PLAY_SCENE';
  if (action === 'WRITE_SCRIPT') return /full/.test(c) ? 'FULL_SCRIPT' : 'SCRIPT_SCENE';
  if (action === 'WRITE_CHAPTER') return 'CHAPTER';
  if (action === 'WRITE_SCENE') return 'SCENE';
  if (action === 'EXPORT') return 'EXPORT_DOCUMENT';
  return 'NOVEL_PROSE';
}

function modeFor(action: RequestedAction): OutputMode {
  if (action === 'MAKE_PLAN') return 'plan';
  if (action === 'CUT' || action === 'COMPRESS') return 'cut';
  if (['POLISH', 'REPAIR', 'REWRITE', 'RED_PEN', 'GOLD_PASS'].includes(action)) return 'improve';
  if (action === 'EXPORT') return 'output';
  return 'write';
}

export function routeCaspaIntent(content = '', command = ''): OutputRoutingDecision {
  const inputType = detectInputType(content, command);
  const requestedAction = detectRequestedAction(command);
  const requestedOutput = inferRequestedOutput(requestedAction, command);
  const outputMode = modeFor(requestedAction);
  const userExplicitlyAskedForPlan = requestedAction === 'MAKE_PLAN' || requestedOutput === 'PLAN';
  const shouldBlockPlan = !userExplicitlyAskedForPlan;
  const requiresImprovementIntake = inputType === 'MANUSCRIPT_DRAFT' && ['POLISH', 'REPAIR', 'REWRITE', 'RED_PEN', 'GOLD_PASS', 'CUT', 'COMPRESS'].includes(requestedAction);

  const systemInstruction = [
    'You are Caspa. Produce the requested artefact first.',
    'Plans are inputs, not outputs, unless the user explicitly asked for a plan.',
    'If given a book plan and asked to write, consume the plan silently and output prose, dialogue or script.',
    'If given a manuscript and asked to improve, output revised text first and notes second.',
    'If asked to cut, remove bloat, repetition, ornament and explanation while preserving meaning and voice.',
    'No purple prose. No padding. No advice instead of artefact.',
  ].join('\n');

  return { inputType, requestedAction, requestedOutput, outputMode, shouldBlockPlan, requiresImprovementIntake, systemInstruction };
}
