/**
 * Story promise registry (local adapter).
 * Source: Caspa main promiseRegistryService (AI/Firebase deps removed).
 */
import type { StoryPromise, PromiseStatus, PromiseType } from './promise.js';

const mem = new Map<string, StoryPromise[]>();

function key(projectId: string) {
  return `promises:${projectId}`;
}

export function loadPromises(projectId: string): StoryPromise[] {
  return mem.get(key(projectId)) ?? [];
}

export function savePromises(projectId: string, promises: StoryPromise[]): void {
  mem.set(key(projectId), promises);
}

export function upsertPromise(projectId: string, promise: StoryPromise): StoryPromise[] {
  const list = loadPromises(projectId);
  const idx = list.findIndex((p) => p.id === promise.id);
  if (idx >= 0) list[idx] = promise;
  else list.push(promise);
  savePromises(projectId, list);
  return list;
}

export function setPromiseStatus(projectId: string, id: string, status: PromiseStatus): StoryPromise[] {
  const list = loadPromises(projectId).map((p) => (p.id === id ? { ...p, status } : p));
  savePromises(projectId, list);
  return list;
}

export function createPromise(input: {
  projectId: string;
  type: PromiseType;
  statement: string;
  setupChapter?: number;
  riskScore?: number;
}): StoryPromise {
  const promise: StoryPromise = {
    id: `prm_${Date.now().toString(36)}`,
    type: input.type,
    statement: input.statement,
    setupChapter: input.setupChapter,
    status: 'planted',
    riskScore: input.riskScore ?? 0,
  };
  upsertPromise(input.projectId, promise);
  return promise;
}

