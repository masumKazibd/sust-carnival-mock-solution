import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import 'dotenv/config';

const MIGRATIONS_FOLDER = './drizzle';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[migrate] DATABASE_URL is not set');
    process.exit(1);
  }

  // Ensure the migrations folder exists so drizzle-kit can write into it later.
  mkdirSync(MIGRATIONS_FOLDER, { recursive: true });

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    console.log('[migrate] migrations applied successfully');
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('[migrate] migration failed:', err);
    await client.end().catch(() => {});
    process.exit(1);
  }
}

main();