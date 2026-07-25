/**
 * Local research note library.
 * Source: Caspa main researchLibraryService (localStorage/memory adapter).
 */

export interface ResearchNote {
  id: string;
  projectId: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

const mem = new Map<string, ResearchNote[]>();

function key(projectId: string) {
  return `research:${projectId}`;
}

export function listNotes(projectId: string, tags?: string[]): ResearchNote[] {
  const notes = mem.get(key(projectId)) ?? [];
  if (!tags?.length) return [...notes];
  return notes.filter((n) => tags.every((t) => n.tags.includes(t)));
}

export function upsertNote(input: {
  projectId: string;
  title: string;
  body: string;
  tags?: string[];
  id?: string;
}): ResearchNote {
  const now = new Date().toISOString();
  const notes = mem.get(key(input.projectId)) ?? [];
  if (input.id) {
    const idx = notes.findIndex((n) => n.id === input.id);
    if (idx >= 0) {
      notes[idx] = {
        ...notes[idx],
        title: input.title,
        body: input.body,
        tags: input.tags ?? notes[idx].tags,
        updatedAt: now,
      };
      mem.set(key(input.projectId), notes);
      return notes[idx];
    }
  }
  const note: ResearchNote = {
    id: input.id ?? `note_${Date.now().toString(36)}`,
    projectId: input.projectId,
    title: input.title,
    body: input.body,
    tags: input.tags ?? [],
    createdAt: now,
    updatedAt: now,
  };
  notes.push(note);
  mem.set(key(input.projectId), notes);
  return note;
}

export function getProjectKey(projectId: string): string {
  return key(projectId);
}
