/**
 * Psychology blueprint helpers (portable storage).
 * Source: Caspa main psychologyEngineService (AI calls left to host).
 */
import type { PsychologyBlueprint } from './psychology.js';

const mem = new Map<string, PsychologyBlueprint>();

export function loadBlueprint(projectId: string): PsychologyBlueprint | null {
  return mem.get(projectId) ?? null;
}

export function saveBlueprint(projectId: string, blueprint: PsychologyBlueprint): void {
  mem.set(projectId, blueprint);
}
