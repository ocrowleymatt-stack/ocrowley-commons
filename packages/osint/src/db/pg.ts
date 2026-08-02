/**
 * Optional Postgres pool for WHO dossiers/entities (nuclear Phase 4).
 * Enabled when DATABASE_URL or OCROWLEY_DATABASE_URL is set.
 */

import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;
let migratePromise: Promise<void> | null = null;

export function databaseUrl(): string {
  return (
    process.env.OCROWLEY_DATABASE_URL ||
    process.env.DATABASE_URL ||
    ''
  ).trim();
}

export function isPostgresEnabled(): boolean {
  return Boolean(databaseUrl());
}

export function getPool(): pg.Pool {
  if (!pool) {
    const url = databaseUrl();
    if (!url) throw new Error('DATABASE_URL / OCROWLEY_DATABASE_URL not set');
    pool = new Pool({
      connectionString: url,
      max: Number(process.env.OCROWLEY_PG_POOL_MAX || 5),
    });
  }
  return pool;
}

export async function pgQuery<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params);
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
  migratePromise = null;
}

export async function ensureMigrated(): Promise<void> {
  if (!isPostgresEnabled()) return;
  if (!migratePromise) {
    migratePromise = (async () => {
      const { migrateWhoSchema } = await import('./migrate.js');
      await migrateWhoSchema();
    })();
  }
  await migratePromise;
}

export async function pgHealth(): Promise<{
  enabled: boolean;
  ok: boolean;
  detail: string;
  trgm: boolean;
}> {
  if (!isPostgresEnabled()) {
    return { enabled: false, ok: false, detail: 'DATABASE_URL not set', trgm: false };
  }
  try {
    await ensureMigrated();
    const r = await pgQuery<{ v: string }>('SELECT version() AS v');
    const ext = await pgQuery<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') AS exists`,
    );
    return {
      enabled: true,
      ok: true,
      detail: String(r.rows[0]?.v || 'ok').split(',')[0] || 'ok',
      trgm: Boolean(ext.rows[0]?.exists),
    };
  } catch (err) {
    return {
      enabled: true,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
      trgm: false,
    };
  }
}
