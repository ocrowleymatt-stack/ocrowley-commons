/**
 * Five-step minimal author path (portable contract).
 * Source inspiration: Caspa studio MinimalWorkflowService.
 */
export const MINIMAL_STEPS = [
  { id: 'seed', title: 'Seed', prompt: 'Capture the wound, desire, and setting in one paragraph.' },
  { id: 'spine', title: 'Spine', prompt: 'List 8–12 chapter turns. No prose.' },
  { id: 'draft', title: 'Draft', prompt: 'Write the next unfinished chapter as artefact-first prose.' },
  { id: 'cut', title: 'Cut', prompt: 'Cut 25–40% while preserving voice and turns.' },
  { id: 'pack', title: 'Pack', prompt: 'Export manuscript + synopsis + query materials.' },
] as const;

export type MinimalStepId = (typeof MINIMAL_STEPS)[number]['id'];

export function nextMinimalStep(done: MinimalStepId[]): (typeof MINIMAL_STEPS)[number] {
  for (const step of MINIMAL_STEPS) {
    if (!done.includes(step.id)) return step;
  }
  return MINIMAL_STEPS[MINIMAL_STEPS.length - 1];
}
