import fs from 'fs/promises';
import path from 'path';
import { getConfig } from './config.js';
import { generateId } from './ids.js';

export async function ensureDataSubDir(subPath: string): Promise<string> {
  const dir = path.join(getConfig().dataDir, subPath);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function readJsonFile<T>(subPath: string, filename: string): Promise<T | null> {
  const filePath = path.join(getConfig().dataDir, subPath, filename);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function writeJsonFile<T>(subPath: string, filename: string, data: T): Promise<void> {
  const filePath = path.join(getConfig().dataDir, subPath, filename);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmpPath, filePath);
}

export async function listJsonFiles(subPath: string): Promise<string[]> {
  const dir = await ensureDataSubDir(subPath);
  try {
    const entries = await fs.readdir(dir);
    return entries.filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
}

export async function deleteJsonFile(subPath: string, filename: string): Promise<boolean> {
  const filePath = path.join(getConfig().dataDir, subPath, filename);
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

export { generateId };
