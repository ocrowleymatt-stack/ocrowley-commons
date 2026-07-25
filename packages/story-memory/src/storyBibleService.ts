/**
 * Story bible aggregate view.
 * Source: Caspa main storyBibleService (simplified).
 */
import { loadPromises } from './promiseRegistryService.js';
import { loadBlueprint } from './psychologyEngineService.js';

export interface StoryBible {
  projectId: string;
  promises: ReturnType<typeof loadPromises>;
  psychology: ReturnType<typeof loadBlueprint>;
  updatedAt: string;
}

export function loadStoryBible(projectId: string): StoryBible {
  return {
    projectId,
    promises: loadPromises(projectId),
    psychology: loadBlueprint(projectId),
    updatedAt: new Date().toISOString(),
  };
}
