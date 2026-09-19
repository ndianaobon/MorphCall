import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

/**
 * Creates a throw-away database, applies the Supabase stub + every migration, and gives the
 * least-privilege API role a test password. Needs a Postgres server at TEST_PG_ADMIN_URL.
 */
const here = dirname(fileURLToPath(import.meta.url));
const ADMIN_URL = process.env.TEST_PG_ADMIN_URL ?? 'postgres://postgres@localhost:55432/postgres';
const DB_NAME = 'morphcall_test';
const API_PASSWORD = 'morphcall_test_pw';

export async function setup() {
  const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`drop database if exists ${DB_NAME} with (force)`);
    await admin.unsafe(`create database ${DB_NAME}`);
  } finally {
    await admin.end();
  }

  const dbUrl = new URL(ADMIN_URL);
  dbUrl.pathname = `/${DB_NAME}`;
  const db = postgres(dbUrl.toString(), { max: 1, onnotice: () => {} });
  try {
    await db.unsafe(readFileSync(join(here, 'supabase-stub.sql'), 'utf8'));
    const migrationsDir = join(here, '../../../supabase/migrations');
    for (const file of readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      await db.unsafe(readFileSync(join(migrationsDir, file), 'utf8'));
    }
    await db.unsafe(`alter role morphcall_api with login password '${API_PASSWORD}'`);
  } finally {
    await db.end();
  }

  const apiUrl = new URL(dbUrl);
  apiUrl.username = 'morphcall_api';
  apiUrl.password = API_PASSWORD;
  process.env.TEST_DATABASE_URL = apiUrl.toString();
  process.env.TEST_DATABASE_ADMIN_URL = dbUrl.toString();
}
