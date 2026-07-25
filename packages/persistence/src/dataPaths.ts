/**
 * Caspa data directory paths (local-first, no secrets in paths exposed to clients)
 */

import fs from 'fs';
import path from 'path';

export function getDataDir(): string {
  const dir = process.env.CASPA_DATA_DIR || path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getJobsFilePath(): string {
  return path.join(getDataDir(), 'caspa-jobs.json');
}

export function getBackupsDir(): string {
  const dir = path.join(getDataDir(), 'backups');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}
