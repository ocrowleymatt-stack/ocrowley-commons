/**
 * Server-side archive of WHO lookups (case-scoped leads, not evidence).
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { WhoResult } from './who.js';

export interface WhoArchiveEntry {
  id: string;
  savedAt: string;
  caseRef: string;
  q: string;
  name: string;
  next: string;
  stats: WhoResult['stats'];
  toolsUsed: string[];
  hits: WhoResult['hits'];
  open: WhoResult['open'];
  text: string;
  warning: string;
}

function archiveRoot(): string {
  const base = process.env.OCROWLEY_DATA_DIR || process.env.DATA_DIR || './data';
  return path.resolve(base, 'who-archive');
}

async function ensureRoot(): Promise<string> {
  const root = archiveRoot();
  await mkdir(root, { recursive: true });
  return root;
}

export async function archiveWhoResult(
  result: WhoResult,
  caseRef: string,
): Promise<WhoArchiveEntry> {
  const root = await ensureRoot();
  const id = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const entry: WhoArchiveEntry = {
    id,
    savedAt: new Date().toISOString(),
    caseRef,
    q: result.q,
    name: result.name,
    next: result.next,
    stats: result.stats,
    toolsUsed: result.toolsUsed || [],
    hits: result.hits,
    open: result.open,
    text: result.text,
    warning: result.warning,
  };
  await writeFile(path.join(root, `${id}.json`), JSON.stringify(entry, null, 2), 'utf8');
  return entry;
}

export async function listWhoArchive(limit = 50): Promise<WhoArchiveEntry[]> {
  const root = await ensureRoot();
  let files: string[] = [];
  try {
    files = (await readdir(root)).filter(f => f.endsWith('.json'));
  } catch {
    return [];
  }
  files.sort().reverse();
  const out: WhoArchiveEntry[] = [];
  for (const f of files.slice(0, limit)) {
    try {
      const raw = await readFile(path.join(root, f), 'utf8');
      out.push(JSON.parse(raw) as WhoArchiveEntry);
    } catch {
      /* skip corrupt */
    }
  }
  return out;
}

export async function readWhoArchive(id: string): Promise<WhoArchiveEntry | null> {
  const safe = id.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!safe) return null;
  try {
    const raw = await readFile(path.join(archiveRoot(), `${safe}.json`), 'utf8');
    return JSON.parse(raw) as WhoArchiveEntry;
  } catch {
    return null;
  }
}
