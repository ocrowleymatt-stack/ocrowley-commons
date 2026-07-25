/**
 * Caspa Promise Registry — tracks what the book owes the reader
 */

export type PromiseType = 'plot' | 'character' | 'theme' | 'revelation' | 'emotional';

export type PromiseStatus =
  | 'planted'
  | 'developing'
  | 'paid_off'
  | 'broken'
  | 'cut_advised'
  | 'open';

export interface StoryPromise {
  id: string;
  type: PromiseType;
  statement: string;
  setupChapter?: number;
  payoffChapter?: number;
  status: PromiseStatus;
  riskScore: number;
  notes?: string;
}

export interface PromiseHealth {
  total: number;
  open: number;
  broken: number;
  paidOff: number;
  overdue: number;
}

export function computePromiseHealth(promises: StoryPromise[]): PromiseHealth {
  const open = promises.filter((p) => ['planted', 'developing', 'open'].includes(p.status)).length;
  const broken = promises.filter((p) => p.status === 'broken').length;
  const paidOff = promises.filter((p) => p.status === 'paid_off').length;
  const overdue = promises.filter(
    (p) =>
      p.payoffChapter &&
      ['planted', 'developing', 'open'].includes(p.status) &&
      p.riskScore >= 70
  ).length;

  return { total: promises.length, open, broken, paidOff, overdue };
}
