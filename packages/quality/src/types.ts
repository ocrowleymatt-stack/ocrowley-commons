export type NovelWriteProMode =
  | 'novel' | 'script' | 'musical' | 'adaptation' | 'polish' | 'chaos';

export type QualityGateStatus = 'pass' | 'warn' | 'fail';

export interface QualityGateFinding {
  gate: string;
  status: QualityGateStatus;
  score: number;
  issues: string[];
}

export type GoldPassId =
  | 'structure' | 'depth' | 'subtext' | 'line-edit' | 'final-cut';

export interface GoldPassDefinition {
  id: GoldPassId;
  name: string;
  detail: string;
}

export const GOLD_PASS_DEFINITIONS: GoldPassDefinition[] = [
  { id: 'structure', name: 'Structure Pass', detail: 'Does the spine hold, or is it wearing a hat and pretending?' },
  { id: 'depth', name: 'Depth Pass', detail: 'Characters, stakes, world, relationships, pressure.' },
  { id: 'subtext', name: 'Subtext Pass', detail: 'Meaning underneath the words. Less furniture, more voltage.' },
  { id: 'line-edit', name: 'Line Edit', detail: 'Pace, clarity, rhythm, voice, cuts.' },
  { id: 'final-cut', name: 'Ruthless Final Cut', detail: 'Remove what is decorative, dead, duplicated or showing off.' },
];
