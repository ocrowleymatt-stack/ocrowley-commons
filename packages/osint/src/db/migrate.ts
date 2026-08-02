import { pgQuery } from './pg.js';

const STATEMENTS = [
  `CREATE EXTENSION IF NOT EXISTS pg_trgm`,
  `CREATE TABLE IF NOT EXISTS who_entities (
      entity_id TEXT NOT NULL,
      case_ref TEXT NOT NULL,
      value TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'person',
      latest_dossier_id TEXT,
      dossier_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      job_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      stats JSONB,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (case_ref, entity_id)
    )`,
  `CREATE INDEX IF NOT EXISTS who_entities_case_updated
      ON who_entities (case_ref, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS who_entities_value_trgm
      ON who_entities USING gin (value gin_trgm_ops)`,
  `CREATE TABLE IF NOT EXISTS who_dossiers (
      id TEXT PRIMARY KEY,
      case_ref TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      job_id TEXT,
      archive_id TEXT,
      encrypted BOOLEAN NOT NULL DEFAULT false,
      dossier JSONB,
      ciphertext TEXT
    )`,
  `CREATE INDEX IF NOT EXISTS who_dossiers_case_saved
      ON who_dossiers (case_ref, saved_at DESC)`,
  `CREATE INDEX IF NOT EXISTS who_dossiers_entity
      ON who_dossiers (case_ref, entity_id)`,
  // Optional vector column for future embeddings (pgvector when installed).
  `DO $$ BEGIN
      CREATE EXTENSION IF NOT EXISTS vector;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END $$`,
  `DO $$ BEGIN
      ALTER TABLE who_entities ADD COLUMN IF NOT EXISTS embedding vector(384);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END $$`,
];

export async function migrateWhoSchema(): Promise<void> {
  for (const sql of STATEMENTS) {
    await pgQuery(sql);
  }
}
