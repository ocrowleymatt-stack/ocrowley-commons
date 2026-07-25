export type InputType =
  | 'MANUSCRIPT_DRAFT'
  | 'BOOK_PLAN'
  | 'PLAY_TREATMENT'
  | 'SCRIPT_TREATMENT'
  | 'RESEARCH_NOTES'
  | 'SOURCE_MATERIAL'
  | 'COMMAND_ONLY'
  | 'MIXED';

export type RequestedAction =
  | 'WRITE_BOOK'
  | 'WRITE_CHAPTER'
  | 'WRITE_SCENE'
  | 'WRITE_PLAY'
  | 'WRITE_SCRIPT'
  | 'CONTINUE'
  | 'POLISH'
  | 'EXPAND'
  | 'CUT'
  | 'COMPRESS'
  | 'REPAIR'
  | 'REWRITE'
  | 'RED_PEN'
  | 'GOLD_PASS'
  | 'MAKE_PLAN'
  | 'SUMMARISE'
  | 'EXPORT';

export type RequestedOutput =
  | 'NOVEL_PROSE'
  | 'CHAPTER'
  | 'SCENE'
  | 'PLAY_SCENE'
  | 'FULL_PLAY'
  | 'SCRIPT_SCENE'
  | 'FULL_SCRIPT'
  | 'POLISHED_TEXT'
  | 'CUT_TEXT'
  | 'PLAN'
  | 'SYNOPSIS'
  | 'TREATMENT'
  | 'PITCH_PACK'
  | 'QUERY_LETTER'
  | 'REHEARSAL_PACK'
  | 'CHARACTER_BIBLE'
  | 'RESEARCH_BRIEF'
  | 'EXPORT_DOCUMENT';

export type OutputMode = 'write' | 'improve' | 'cut' | 'research' | 'output' | 'plan';

export interface CaspaOutputContract {
  inputType: InputType;
  requestedAction: RequestedAction;
  requestedOutput: RequestedOutput;
  outputMode: OutputMode;
  primaryOutput: string;
  notes: string[];
  nextBestMove: string;
}

export interface OutputRoutingDecision {
  inputType: InputType;
  requestedAction: RequestedAction;
  requestedOutput: RequestedOutput;
  outputMode: OutputMode;
  shouldBlockPlan: boolean;
  requiresImprovementIntake: boolean;
  systemInstruction: string;
}

export interface ImprovementBrief {
  manuscriptId?: string;
  userIntent: string;
  selectedImprovementModes: string[];
  userDiagnosis?: string;
  externalReviews?: string;
  reviewAnalysis?: ReviewAnalysis;
  priorityMode?: string;
  nonNegotiables?: string[];
  targetOutcome?: string;
  forbiddenChanges?: string[];
}

export interface ReviewAnalysis {
  praisedElements: string[];
  criticisedElements: string[];
  requestedChanges: string[];
  contradictionsBetweenReviews: string[];
  nonNegotiables: string[];
  suggestedImprovementPriorities: string[];
}

export interface ResearchFinding {
  claim: string;
  sourceTitle?: string;
  sourceUrl?: string;
  sourceType?: string;
  confidence: 'low' | 'medium' | 'high';
  relevance: string;
  writingUse: string;
  citation?: string;
}

export interface ResearchRunResult {
  status: 'complete' | 'web_search_unavailable' | 'error';
  summary: string;
  findings: ResearchFinding[];
  suggestedNextSearches: string[];
  contradictions: string[];
  gaps: string[];
}
