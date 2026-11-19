// Applies schema.sql (repo root) to the Neon database referenced by
// DATABASE_URL, then verifies the table's column count.
//
//   export DATABASE_URL="$(sed -n '1s/^DATABASE_URL=//p' /path/to/neon-connection-string.txt)"
//   npm install @neondatabase/serverless
//   node scripts/apply-schema.mjs
//
// The source file must be the Neon POOLED CONNECTION STRING (it exports
// DATABASE_URL). neon-storage.env holds Neon STORAGE and AI-Gateway
// credentials only — it has no DATABASE_URL and cannot drive this script.
//
// Note: the URL may contain '&' (e.g. channel_binding=require). Sourcing it
// with `.` in a shell will split on '&'; export DATABASE_URL from the file
// with quoting instead, e.g.
//   export DATABASE_URL="$(sed -n '1s/^DATABASE_URL=//p' /path/to/neon-connection-string.txt)"

import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = neon(url);
const ddl = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

// Statements end with ';' at end of line; the DDL contains no semicolons
// inside literals, so a line-end split is safe.
const statements = ddl
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter((s) => s !== '' && s.replace(/^(--.*\n?)+/g, '').trim() !== '');

for (const stmt of statements) {
  const label = stmt.replace(/^(--.*\n)+/, '').split('\n')[0].slice(0, 60);
  console.log('applying:', label);
  try {
    await sql.query(stmt);
  } catch (err) {
    // 42P07 duplicate_table / 42710 duplicate_object: the object already
    // exists, so this statement is a no-op on a re-run. Anything else is a
    // real failure and must abort the apply.
    if (err.code === '42P07' || err.code === '42710') {
      console.log('  already exists, skipping:', label);
      continue;
    }
    throw err;
  }
}

const EXPECTED_COLUMN_COUNT = 38;

const rows = await sql`
  SELECT count(*)::int AS n
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'requirement_submissions'
`;
const columnCount = rows[0].n;
console.log('requirement_submissions columns:', columnCount);

if (columnCount !== EXPECTED_COLUMN_COUNT) {
  console.error(
    `ERROR: requirement_submissions has ${columnCount} columns, expected ${EXPECTED_COLUMN_COUNT}. ` +
      'The database schema does not match schema.sql — re-apply schema.sql or fix the drift before deploying.'
  );
  process.exit(1);
}

console.log(`OK: requirement_submissions has the expected ${EXPECTED_COLUMN_COUNT} columns.`);
