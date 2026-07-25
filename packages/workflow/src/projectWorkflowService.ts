/**
 * Guided next-step workflow state machine.
 * Source: Caspa cursor/simplify-studio-workflow-71b0 projectWorkflowService (decoupled).
 */
import type { ProjectWorkflowState, WorkflowStep, WorkflowStepId } from './types.js';

const STEPS: WorkflowStep[] = [
  { id: 'intake', title: 'Intake', rationale: 'Capture source material, brief, or seed.', ctaLabel: 'Add material' },
  { id: 'plan', title: 'Plan', rationale: 'Only when explicitly requested — spine before prose.', ctaLabel: 'Build spine' },
  { id: 'draft', title: 'Draft', rationale: 'Produce artefact-first chapter/scene prose.', ctaLabel: 'Write next' },
  { id: 'improve', title: 'Improve', rationale: 'Cut, polish, or gold-pass the draft.', ctaLabel: 'Improve' },
  { id: 'export', title: 'Export', rationale: 'Package manuscript when gates pass.', ctaLabel: 'Export' },
];

export function listWorkflowSteps(): WorkflowStep[] {
  return [...STEPS];
}

export function getStep(id: WorkflowStepId): WorkflowStep | undefined {
  return STEPS.find((s) => s.id === id);
}

export function createWorkflowState(projectId: string): ProjectWorkflowState {
  return {
    projectId,
    currentStep: 'intake',
    completedSteps: [],
    updatedAt: new Date().toISOString(),
  };
}

export function suggestNextStep(state: ProjectWorkflowState): WorkflowStep {
  for (const step of STEPS) {
    if (!state.completedSteps.includes(step.id)) return step;
  }
  return { id: 'idle', title: 'Idle', rationale: 'All guided steps complete.', ctaLabel: 'Review' };
}

export function completeStep(state: ProjectWorkflowState, stepId: WorkflowStepId): ProjectWorkflowState {
  const completed = state.completedSteps.includes(stepId)
    ? state.completedSteps
    : [...state.completedSteps, stepId];
  const next = suggestNextStep({ ...state, completedSteps: completed });
  return {
    ...state,
    completedSteps: completed,
    currentStep: next.id,
    updatedAt: new Date().toISOString(),
  };
}
