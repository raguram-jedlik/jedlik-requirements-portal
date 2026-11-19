// Applies schema.sql (repo root) to the Neon database referenced by
// DATABASE_URL, then verifies the table's column count.
//
//   set -a; . /path/to/neon-storage.env; set +a
//   npm install @neondatabase/serverless
//   node scripts/apply-schema.mjs

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
  await sql.query(stmt);
}

const rows = await sql`
  SELECT count(*)::int AS n
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'requirement_submissions'
`;
console.log('requirement_submissions columns:', rows[0].n);
