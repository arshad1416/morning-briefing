import { env } from 'cloudflare:test';
// Load the schema as a build-time raw string. Test code runs INSIDE workerd,
// where node:fs readFileSync is not implemented, so we can't read from disk at
// runtime — Vite's `?raw` import inlines the file contents at bundle time.
import initSql from '../migrations/0001_init.sql?raw';
import billingSql from '../migrations/0002_billing.sql?raw';
export async function migrate() {
  for (const sql of [initSql, billingSql]) {
    // Strip full-line `--` comments first so a semicolon inside a comment
    // doesn't split into a statement-less fragment (D1 rejects those).
    const clean = sql.replace(/^\s*--.*$/gm, '');
    for (const stmt of clean.split(';').map((s) => s.trim()).filter(Boolean)) {
      try {
        await env.DB.prepare(stmt).run();
      } catch (e) {
        // ALTER TABLE isn't idempotent; tolerate re-running migrate().
        if (!/duplicate column name/i.test(e.message || '')) throw e;
      }
    }
  }
}
export function sessionCookie(res) {
  const raw = res.headers.get('Set-Cookie') || '';
  const m = raw.match(/mg_session=([^;]+)/);
  return m ? `mg_session=${m[1]}` : '';
}
