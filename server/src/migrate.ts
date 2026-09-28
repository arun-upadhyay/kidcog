/**
 * Runs the database migrations in supabase/migrations/ straight from the
 * terminal, so there is no need to paste SQL into the Supabase dashboard.
 *
 *   npm run migrate              show which migrations have run and which are waiting
 *   npm run migrate -- --yes     run the waiting ones, oldest first
 *   npm run migrate -- --baseline 202609280001
 *                                one time only: record that everything up to and including
 *                                that migration was already run by hand in the dashboard
 *
 * Needs DATABASE_URL in server/.env: Supabase → your project → Connect →
 * "Session pooler" connection string, with your database password filled in.
 * Never commit it (server/.env is git-ignored).
 *
 * Each migration runs inside a transaction: if any statement fails, none of
 * that file is applied and the script stops. What has run is recorded in
 * supabase_migrations.schema_migrations, the same table the Supabase CLI uses,
 * so `supabase db push` would agree with this script later.
 */
import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'supabase', 'migrations');

const args = process.argv.slice(2);
const confirmed = args.includes('--yes');
const baselineAt = args.includes('--baseline') ? args[args.indexOf('--baseline') + 1] : undefined;

type Migration = { version: string; name: string; file: string };

function localMigrations(): Migration[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter(f => /^\d+_.+\.sql$/.test(f))
    .sort()
    .map(file => {
      const [version, ...rest] = file.replace(/\.sql$/, '').split('_');
      return { version: version!, name: rest.join('_'), file };
    });
}

function connectionString(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error(`
DATABASE_URL is not set.

Add it to server/.env (never commit it):
  1. Supabase dashboard → your project → Connect (top of the page).
  2. Copy the "Session pooler" connection string (it works on every network).
  3. Replace [YOUR-PASSWORD] with your database password
     (Project Settings → Database → Reset database password if you don't have it).
  4. In server/.env add:  DATABASE_URL=postgresql://postgres.xxxx:PASSWORD@aws-0-….pooler.supabase.com:5432/postgres
`);
    process.exit(1);
  }
  // SSL is set below; a sslmode in the URL would make node-postgres insist on a CA it doesn't have.
  return url.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
}

/** Hides the password if an error message ever includes the address. */
const redact = (text: string) => text.replace(/(postgres(?:ql)?:\/\/[^:\s]+:)[^@\s]+@/gi, '$1•••@');

async function main() {
  const migrations = localMigrations();
  const url = connectionString();
  const local = /@(localhost|127\.0\.0\.1)(:|\/)/.test(url);
  const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  try {
    await client.connect();
  } catch (error) {
    console.error(`\nCould not connect to the database: ${redact(error instanceof Error ? error.message : String(error))}`);
    console.error('Check DATABASE_URL (use the "Session pooler" string) and that your password is right.\n');
    process.exit(1);
  }

  try {
    await client.query(`create schema if not exists supabase_migrations;
      create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);`);
    const { rows } = await client.query<{ version: string }>('select version from supabase_migrations.schema_migrations');
    const applied = new Set(rows.map(r => r.version));

    if (baselineAt) {
      if (!migrations.some(m => m.version === baselineAt)) {
        console.error(`\nNo migration ${baselineAt} in supabase/migrations. Versions: ${migrations.map(m => m.version).join(', ')}\n`);
        process.exit(1);
      }
      const upTo = migrations.filter(m => m.version <= baselineAt && !applied.has(m.version));
      for (const m of upTo) await client.query('insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3) on conflict (version) do nothing', [m.version, m.name, []]);
      console.log(`\nRecorded ${upTo.length} migration${upTo.length === 1 ? '' : 's'} as already run (nothing was executed):`);
      upTo.forEach(m => console.log(`  ✓ ${m.file}`));
      console.log('\nNow run: npm run migrate\n');
      return;
    }

    console.log(`\nMigrations in supabase/migrations (${migrations.length}):`);
    for (const m of migrations) console.log(`  ${applied.has(m.version) ? '✓ ran    ' : '… waiting'}  ${m.file}`);
    const pending = migrations.filter(m => !applied.has(m.version));

    if (pending.length === 0) { console.log('\nThe database is up to date.\n'); return; }

    // First use on a database that was set up by hand: running the old files again would fail.
    if (applied.size === 0) {
      const { rows: existing } = await client.query<{ found: string | null }>("select to_regclass('public.child_profiles')::text as found");
      if (existing[0]?.found) {
        console.log(`
This database already has KidCog tables, but no record of which migrations ran
(they were probably pasted into the Supabase dashboard). Tell the script which
was the last one you ran by hand, for example:

  npm run migrate -- --baseline ${migrations.at(-2)?.version ?? migrations[0]!.version}

Then run npm run migrate again. Nothing has been changed.
`);
        return;
      }
    }

    if (!confirmed) { console.log(`\n${pending.length} waiting. Nothing done yet — run again with --yes to apply ${pending.length === 1 ? 'it' : 'them'}.\n`); return; }

    console.log('');
    for (const m of pending) {
      const sql = readFileSync(path.join(MIGRATIONS_DIR, m.file), 'utf8');
      process.stdout.write(`  → ${m.file} … `);
      try {
        await client.query('begin');
        await client.query(sql);
        await client.query('insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)', [m.version, m.name, [sql]]);
        await client.query('commit');
        console.log('done');
      } catch (error) {
        await client.query('rollback').catch(() => {});
        console.log('FAILED');
        console.error(`\n  ${redact(error instanceof Error ? error.message : String(error))}`);
        console.error(`\n  Nothing from ${m.file} was applied. Fix it and run npm run migrate -- --yes again.\n`);
        process.exitCode = 1;
        return;
      }
    }
    console.log(`\nApplied ${pending.length} migration${pending.length === 1 ? '' : 's'}. The database is up to date.\n`);
  } finally {
    await client.end().catch(() => {});
  }
}

void main();
