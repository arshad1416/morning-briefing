import { env } from 'cloudflare:test';
// Load the schema as a build-time raw string. Test code runs INSIDE workerd,
// where node:fs readFileSync is not implemented, so we can't read from disk at
// runtime — Vite's `?raw` import inlines the file contents at bundle time.
import initSql from '../migrations/0001_init.sql?raw';
import migrationSql from '../migrations/0002_billing_sessions.sql?raw';
export async function migrate() {
  for (const stmt of initSql.split(';').map((s) => s.trim()).filter(Boolean)) {
    await env.DB.prepare(stmt).run();
  }
  for (const stmt of migrationSql.split(';').map((s) => s.trim()).filter(Boolean)) {
    await env.DB.prepare(stmt).run();
  }
}
export function sessionCookie(res) {
  const raw = res.headers.get('Set-Cookie') || '';
  const m = raw.match(/mg_session=([^;]+)/);
  return m ? `mg_session=${m[1]}` : '';
}
