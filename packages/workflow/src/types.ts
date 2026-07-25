export type WorkflowStepId =
  | 'intake'
  | 'plan'
  | 'draft'
  | 'improve'
  | 'export'
  | 'idle';

export interface WorkflowStep {
  id: WorkflowStepId;
  title: string;
  rationale: string;
  ctaLabel: string;
}

export interface ProjectWorkflowState {
  projectId: string;
  currentStep: WorkflowStepId;
  completedSteps: WorkflowStepId[];
  updatedAt: string;
}
