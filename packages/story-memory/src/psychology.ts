/**
 * Caspa Psychology Engine — emotional journey design
 */

export interface EmotionalVector {
  hope: number;
  grief: number;
  tension: number;
  joy: number;
  catharsis: number;
}

export interface EmotionalBeat {
  act: number;
  label: string;
  target: EmotionalVector;
  techniques: string[];
  chapterFrom?: number;
  chapterTo?: number;
  notes?: string;
}

export interface PsychologyBlueprint {
  id: string;
  userIntent: string;
  journeySummary: string;
  beats: EmotionalBeat[];
  endingTarget: EmotionalVector;
  hiddenMeaning?: string;
  twistReveal?: string;
  createdAt: number;
}

export function defaultVector(): EmotionalVector {
  return { hope: 50, grief: 30, tension: 40, joy: 35, catharsis: 45 };
}
