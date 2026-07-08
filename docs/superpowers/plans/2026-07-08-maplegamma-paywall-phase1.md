# MapleGamma Paywall — Phase 1 (Account System) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real, Worker-enforced account system to the MapleGamma site — signup/login via email-password, Google OAuth, AND passkeys; a signed-cookie session verified against the DB on every request; a 14-day anti-farmed trial; a legal/consent gate excluding Quebec; frontend route-gating with a paywall + pricing page; and mock billing — so paid routes (Research/Screener/Charts/Models) are gated behind entitlement.

**Architecture:** The existing `morning-briefing-chat` Cloudflare Worker (single `src/index.js`, chat-proxy only) is expanded into a small multi-module app using **Hono** (router + cookie + jwt helpers). State lives in a new **Cloudflare D1** database bound to the Worker. Sessions are HMAC-JWTs in an httpOnly cookie, verified by signature AND a `SELECT 1 FROM users` point-read on every gated request (designs out CompCeiling's ghost-session bug). Passwords hash with PBKDF2-SHA256 via WebCrypto (bcrypt is unavailable in the Workers runtime). Passkeys use `@simplewebauthn/server`. Google OAuth is an explicit authorization-code flow. Phase 1 keeps the **UX gate** (frontend hides paid routes for non-entitled users); the **hard data gate** (private R2) is Phase 2. Billing is a mockable interface (`MOCK_BILLING=1`); real Helcim is Phase 3 and stays off until legal review clears.

**Tech Stack:** Cloudflare Workers, Hono, Cloudflare D1 (SQLite), WebCrypto (PBKDF2 + HMAC), `@simplewebauthn/server` + `@simplewebauthn/browser`, vitest + `@cloudflare/vitest-pool-workers`, vanilla-JS SPA frontend (`assets/js/`).

---

## Repos & working locations

- **Worker + frontend:** `arshad1416/morning-briefing`. The canonical working tree is the Pi clone at `~/morning-briefing`. Build/test the Worker locally on the Pi under `cloudflare-worker/`. Deploy = `npx wrangler deploy` from `cloudflare-worker/`; frontend deploys via the Pages pipeline (push to `main`).
- **Deploy discipline (known repo-clobber history):** before any commit on the Pi, `git fetch origin && git reset origin/main` (or rebase) — a Mac rsync used to clobber this repo; confirm clean sync before pipeline changes land.
- **The OAuth secret files** (Worker secrets) are set with `wrangler secret put` piped from a gitignored file — never pasted in chat, never committed.

## File Structure (Phase 1)

Worker (`~/morning-briefing/cloudflare-worker/`):
- `src/index.js` — **modify**: replace the hand-rolled fetch handler with a Hono app; mount the existing `/chat` handler + new `/api/auth/*` and `/api/billing/*` routes.
- `src/chat.js` — **create**: the existing chat-proxy logic moved out of `index.js` verbatim (one responsibility: chat).
- `src/db.js` — **create**: D1 helpers (`getUserById`, `getUserByEmail`, `createUser`, subscription/consent/trial/credential/oauth accessors).
- `src/session.js` — **create**: JWT sign/verify (HMAC-SHA256 via `hono/jwt`), `setSession`/`clearSession` cookie helpers, `requireSession` middleware (signature + point-read), `entitlement()` (trial/tier resolution).
- `src/password.js` — **create**: PBKDF2 hash + verify + dummy-hash timing equalizer.
- `src/auth_password.js` — **create**: `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
- `src/auth_oauth.js` — **create**: `GET /api/auth/oauth/google/start`, `GET /api/auth/oauth/google/callback`.
- `src/auth_passkey.js` — **create**: register + authenticate ceremonies (`/api/auth/passkey/register/options|verify`, `/api/auth/passkey/login/options|verify`).
- `src/trial.js` — **create**: `startTrial` + anti-farming (device cookie + IP claims).
- `src/legal.js` — **create**: consent validation (Terms/Privacy/ack/Quebec) + version constants.
- `src/billing.js` — **create**: mockable billing interface (`createCheckout`, `activateSubscription`, `verifyWebhook` stub).
- `src/util.js` — **create**: shared `getOrigin`/CORS allow-list (moved from `index.js`), `clientIp`, `randomId`.
- `migrations/0001_init.sql` — **create**: D1 schema.
- `wrangler.toml` — **modify**: add `[[d1_databases]]` binding, `[vars]` (APP_URL, MOCK_BILLING, TERMS_VERSION, ACK_VERSION, RP_ID, RP_NAME, GOOGLE_CLIENT_ID), compatibility flags.
- `package.json` — **modify**: add deps (`hono`, `@simplewebauthn/server`) + devDeps (`vitest`, `@cloudflare/vitest-pool-workers`) + scripts (`test`, `db:migrate:local`, `db:migrate:remote`).
- `vitest.config.js` — **create**: Workers pool + D1 migration bootstrap.
- `test/helpers.js` — **create**: apply migrations to the test D1, build authed request cookies.
- `test/*.test.js` — **create** per task.

Frontend (`~/morning-briefing/`):
- `assets/js/auth.js` — **create**: `Auth` module (`me()` cached entitlement, `login/signup/logout`, passkey browser calls, OAuth redirect, gate helper).
- `assets/js/pages/account.js` — **create**: signup/login page (all three methods) + legal gate.
- `assets/js/pages/pricing.js` — **create**: public pricing page + upgrade CTA.
- `assets/js/pages/paywall.js` — **create**: "upgrade to view" interstitial for gated routes.
- `assets/js/app.js` — **modify**: register `/account`, `/pricing` routes; wrap paid routes (`/positions`,`/research`,`/charts`,`/screener`,`/models`) with an entitlement guard.
- `assets/js/router.js` — **modify**: allow an async guard to run before a route handler.
- `index.html` — **modify**: load `@simplewebauthn/browser` (vendored, CSP-safe), `auth.js`, page scripts; add an auth affordance to the nav.
- `terms.html`, `privacy.html` — **create**: static legal pages (adapt CompCeiling drafts).
- `assets/js/vendor/simplewebauthn-browser.umd.min.js` — **create**: vendored (CSP blocks CDN).

Repo hygiene (ShiftLogic worktree — separate repo, the one holding the exposed secret):
- `.gitignore` — **modify**: ignore the Google OAuth client-secret JSON; `git rm --cached` it if tracked.

---

## Owner prerequisites (cannot be done by the agent)

- [ ] **Rotate + re-key the exposed Hermes OAuth secret** (the `Hermes Google Cloud OAuth - client_secret_*.json` in the ShiftLogic worktree root has been on disk unignored). Do this in Google Cloud Console.
- [ ] **Create a NEW Google "Web application" OAuth client** for MapleGamma. Authorized redirect URI: `https://briefing.arshadkazi.ca/api/auth/oauth/google/callback`. Provide the **client ID** (public — goes in `wrangler.toml [vars].GOOGLE_CLIENT_ID`) and **client secret** (goes into a gitignored file so the agent can `wrangler secret put GOOGLE_CLIENT_SECRET` without seeing it, or the owner sets it directly).
- [ ] Helcim account + token — **Phase 3 only**, not needed for Phase 1 (mock billing).

---

## Task 0: Secure the exposed OAuth secret (do first)

**Files:**
- Modify: `<ShiftLogic worktree>/.gitignore`

- [ ] **Step 1: Check whether the secret is tracked**

Run (in the ShiftLogic worktree root):
```bash
git ls-files --error-unmatch "Hermes Google Cloud OAuth - client_secret_231530736431-k6s1jptrqu2fgeh1b9valrjsr0sgkmek.apps.googleusercontent.com.json" 2>/dev/null && echo TRACKED || echo UNTRACKED
```
Expected: prints `TRACKED` or `UNTRACKED`.

- [ ] **Step 2: Add ignore rules**

Append to `.gitignore`:
```
# Google OAuth client-secret JSON files — never commit
*client_secret_*.apps.googleusercontent.com.json
Hermes Google Cloud OAuth*.json
```

- [ ] **Step 3: If TRACKED, remove from index (keep on disk)**

```bash
git rm --cached "Hermes Google Cloud OAuth - client_secret_231530736431-k6s1jptrqu2fgeh1b9valrjsr0sgkmek.apps.googleusercontent.com.json"
```
(If it was ever committed, the value is in history — the owner-prerequisite rotation above is what actually neutralizes it.)

- [ ] **Step 4: Verify ignored**

Run: `git check-ignore "Hermes Google Cloud OAuth - client_secret_231530736431-k6s1jptrqu2fgeh1b9valrjsr0sgkmek.apps.googleusercontent.com.json"`
Expected: prints the filename (now ignored).

- [ ] **Step 5: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore Google OAuth client-secret files (were exposed unignored)"
```

---

## Task 1: Scaffold D1, Hono, and the test harness

**Files:**
- Modify: `cloudflare-worker/package.json`
- Modify: `cloudflare-worker/wrangler.toml`
- Create: `cloudflare-worker/migrations/0001_init.sql`
- Create: `cloudflare-worker/vitest.config.js`
- Create: `cloudflare-worker/test/helpers.js`
- Create: `cloudflare-worker/src/chat.js`
- Modify: `cloudflare-worker/src/index.js`
- Create: `cloudflare-worker/src/util.js`
- Test: `cloudflare-worker/test/smoke.test.js`

- [ ] **Step 1: Create the D1 database**

```bash
cd ~/morning-briefing/cloudflare-worker
npx wrangler d1 create maplegamma
```
Expected: prints a `database_id`. Copy it into `wrangler.toml` (next step).

- [ ] **Step 2: Update `wrangler.toml`**

Replace the file with:
```toml
name = "morning-briefing-chat"
main = "src/index.js"
compatibility_date = "2026-06-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "maplegamma"
database_id = "<PASTE_FROM_STEP_1>"

[vars]
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_MODEL = "deepseek/deepseek-v4-pro"
RATE_LIMIT_PER_MIN = 10
APP_URL = "https://briefing.arshadkazi.ca"
MOCK_BILLING = "1"
TERMS_VERSION = "2026-07-08"
ACK_VERSION = "2026-07-08"
RP_ID = "briefing.arshadkazi.ca"
RP_NAME = "MapleGamma"
GOOGLE_CLIENT_ID = "<OWNER_PROVIDES_WEB_CLIENT_ID>"

# Secrets (never in this file):
#   wrangler secret put SESSION_SECRET
#   wrangler secret put GOOGLE_CLIENT_SECRET
#   wrangler secret put OPENROUTER_API_KEY
```

- [ ] **Step 3: Write the schema `migrations/0001_init.sql`**

```sql
-- users: pw_hash NULLABLE (OAuth/passkey-only users have no password)
CREATE TABLE users (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  pw_hash      TEXT,
  created_at   INTEGER NOT NULL,
  signup_ip    TEXT
);

CREATE TABLE oauth_identities (
  provider          TEXT NOT NULL,
  provider_user_id  TEXT NOT NULL,
  user_id           TEXT NOT NULL REFERENCES users(id),
  email             TEXT,
  created_at        INTEGER NOT NULL,
  PRIMARY KEY (provider, provider_user_id)
);

CREATE TABLE credentials (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id),
  credential_id  TEXT NOT NULL UNIQUE,
  public_key     TEXT NOT NULL,
  counter        INTEGER NOT NULL DEFAULT 0,
  transports     TEXT,
  created_at     INTEGER NOT NULL
);

-- short-lived WebAuthn challenges; user_id NULL during login (usernameless disallowed here, but kept nullable for register-before-login flows)
CREATE TABLE webauthn_challenges (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  challenge   TEXT NOT NULL,
  type        TEXT NOT NULL,        -- 'register' | 'login'
  expires_at  INTEGER NOT NULL
);

CREATE TABLE subscriptions (
  user_id             TEXT PRIMARY KEY REFERENCES users(id),
  tier                TEXT NOT NULL,               -- 'trial' | 'basic' | 'pro'
  status              TEXT NOT NULL,               -- 'active' | 'expired' | 'canceled'
  trial_ends_at       INTEGER,
  current_period_end  INTEGER,
  helcim_customer_id  TEXT,
  helcim_plan_id      TEXT
);

CREATE TABLE trial_claims (
  device_id   TEXT NOT NULL,
  ip          TEXT NOT NULL,
  user_id     TEXT NOT NULL REFERENCES users(id),
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_trial_device ON trial_claims(device_id);
CREATE INDEX idx_trial_ip ON trial_claims(ip, created_at);

CREATE TABLE consents (
  user_id         TEXT NOT NULL REFERENCES users(id),
  terms_version   TEXT NOT NULL,
  ack_version     TEXT NOT NULL,
  quebec_attested INTEGER NOT NULL,   -- 0/1: user attested they are NOT in Quebec
  ts              INTEGER NOT NULL
);

CREATE TABLE auth_events (
  id     TEXT PRIMARY KEY,
  email  TEXT,
  ip     TEXT,
  type   TEXT NOT NULL,   -- 'login_ok'|'login_fail'|'signup'|'rate_limited'
  ts     INTEGER NOT NULL
);
CREATE INDEX idx_auth_email_ts ON auth_events(email, ts);
CREATE INDEX idx_auth_ip_ts ON auth_events(ip, ts);
```

- [ ] **Step 4: Add deps + scripts to `package.json`**

```json
{
  "name": "morning-briefing-chat",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.js",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "db:migrate:local": "wrangler d1 migrations apply maplegamma --local",
    "db:migrate:remote": "wrangler d1 migrations apply maplegamma --remote"
  },
  "dependencies": {
    "hono": "^4.6.0",
    "@simplewebauthn/server": "^11.0.0"
  },
  "devDependencies": {
    "wrangler": "^4.0.0",
    "vitest": "^2.1.0",
    "@cloudflare/vitest-pool-workers": "^0.5.0"
  }
}
```
Run: `npm install`

- [ ] **Step 5: Write `vitest.config.js`**

```js
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: { compatibilityFlags: ['nodejs_compat'] },
      },
    },
  },
});
```

- [ ] **Step 6: Write `test/helpers.js` (apply schema to the test D1)**

```js
import { env } from 'cloudflare:test';
import { readFileSync } from 'node:fs';

export async function migrate() {
  const sql = readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8');
  for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
    await env.DB.prepare(stmt).run();
  }
}

// Extract the mg_session cookie value from a Set-Cookie header on a Response.
export function sessionCookie(res) {
  const raw = res.headers.get('Set-Cookie') || '';
  const m = raw.match(/mg_session=([^;]+)/);
  return m ? `mg_session=${m[1]}` : '';
}
```

- [ ] **Step 7: Move chat logic to `src/chat.js`**

Create `src/chat.js` exporting `handleChat(request, env)` containing the current `/chat` body from `src/index.js` (the `fetchLiveData`, prompts, `positionDisclosure`, and the POST handler). Keep it byte-for-byte behaviorally identical. Export:
```js
export async function handleChat(request, env) { /* ...existing chat logic, returns a Response... */ }
```

- [ ] **Step 8: Move CORS/util to `src/util.js`**

```js
const ALLOWED_ORIGINS = [
  'https://briefing.arshadkazi.ca',
  /^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.morningbriefing\.pages\.dev$/,
];
export function getOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return 'https://briefing.arshadkazi.ca';
  if (ALLOWED_ORIGINS.some((o) => (typeof o === 'string' ? o === origin : o.test(origin)))) return origin;
  return 'https://briefing.arshadkazi.ca';
}
export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || '0.0.0.0';
}
export function randomId() {
  return crypto.randomUUID();
}
```

- [ ] **Step 9: Rewrite `src/index.js` as a Hono app**

```js
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleChat } from './chat.js';
import { getOrigin } from './util.js';
import { mountPasswordAuth } from './auth_password.js';
import { mountOauth } from './auth_oauth.js';
import { mountPasskey } from './auth_passkey.js';
import { mountBilling } from './billing.js';

const app = new Hono();

app.use('/api/*', async (c, next) => {
  const origin = getOrigin(c.req.raw);
  if (c.req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  await next();
  c.res.headers.set('Access-Control-Allow-Origin', origin);
  c.res.headers.set('Access-Control-Allow-Credentials', 'true');
});

app.post('/chat', (c) => handleChat(c.req.raw, c.env));
mountPasswordAuth(app);
mountOauth(app);
mountPasskey(app);
mountBilling(app);

app.get('/api/health', (c) => c.json({ ok: true }));

export default app;
```

- [ ] **Step 10: Write smoke test `test/smoke.test.js`**

```js
import { describe, it, expect, beforeAll } from 'vitest';
import app from '../src/index.js';
import { env } from 'cloudflare:test';
import { migrate } from './helpers.js';

beforeAll(() => migrate());

describe('smoke', () => {
  it('health returns ok', async () => {
    const res = await app.request('/api/health', {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 11: Run tests (expect FAIL until mounts exist)**

Run: `npm test`
Expected: FAIL — `mountPasswordAuth`/`mountOauth`/`mountPasskey`/`mountBilling` not defined. (Create empty stubs exporting each `mountX = (app) => {}` in the four files so the smoke test passes; the real handlers land in later tasks.)

- [ ] **Step 12: Add stubs + re-run**

Create `src/auth_password.js`, `src/auth_oauth.js`, `src/auth_passkey.js`, `src/billing.js`, each with `export function mountX(app) {}` (correct name). Run: `npm test` → smoke PASS.

- [ ] **Step 13: Commit**

```bash
git add cloudflare-worker
git commit -m "feat(worker): scaffold D1 + Hono + vitest, split chat/util, health route"
```

---

## Task 2: Password hashing (PBKDF2 via WebCrypto)

**Files:**
- Create: `cloudflare-worker/src/password.js`
- Test: `cloudflare-worker/test/password.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, DUMMY_HASH } from '../src/password.js';

describe('password', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const h = await hashPassword('correct horse battery');
    expect(await verifyPassword('correct horse battery', h)).toBe(true);
    expect(await verifyPassword('wrong', h)).toBe(false);
  });
  it('produces distinct salts each call', async () => {
    expect(await hashPassword('x')).not.toBe(await hashPassword('x'));
  });
  it('DUMMY_HASH verifies against nothing but does not throw', async () => {
    expect(await verifyPassword('anything', DUMMY_HASH)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- password`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/password.js`**

```js
const ITER = 210000;
const enc = new TextEncoder();

function b64(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function unb64(s) { return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); }

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, key, 256);
  return `pbkdf2$${ITER}$${b64(salt)}$${b64(bits)}`;
}

export async function verifyPassword(password, stored) {
  try {
    const [scheme, iterStr, saltB64, hashB64] = stored.split('$');
    if (scheme !== 'pbkdf2') return false;
    const salt = unb64(saltB64);
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: Number(iterStr), hash: 'SHA-256' }, key, 256);
    const a = new Uint8Array(bits), b = unb64(hashB64);
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]; // constant-time compare
    return diff === 0;
  } catch {
    return false;
  }
}

// A real-shaped hash for timing equalization on unknown emails. Never matches.
export const DUMMY_HASH = `pbkdf2$${ITER}$${b64(new Uint8Array(16))}$${b64(new Uint8Array(32))}`;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- password`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add cloudflare-worker/src/password.js cloudflare-worker/test/password.test.js
git commit -m "feat(worker): PBKDF2 password hashing with constant-time verify + dummy hash"
```

---

## Task 3: DB accessors

**Files:**
- Create: `cloudflare-worker/src/db.js`
- Test: `cloudflare-worker/test/db.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { migrate } from './helpers.js';
import { createUser, getUserById, getUserByEmail, getSubscription, upsertSubscription } from '../src/db.js';

beforeAll(() => migrate());

describe('db', () => {
  it('creates and reads a user by id and email', async () => {
    const u = await createUser(env.DB, { email: 'a@test.ca', pwHash: 'h', ip: '1.1.1.1' });
    expect(u.id).toBeTruthy();
    expect((await getUserById(env.DB, u.id)).email).toBe('a@test.ca');
    expect((await getUserByEmail(env.DB, 'a@test.ca')).id).toBe(u.id);
  });
  it('upserts and reads a subscription', async () => {
    const u = await createUser(env.DB, { email: 'b@test.ca', pwHash: null, ip: '1.1.1.1' });
    await upsertSubscription(env.DB, u.id, { tier: 'trial', status: 'active', trialEndsAt: 999 });
    const s = await getSubscription(env.DB, u.id);
    expect(s.tier).toBe('trial');
    expect(s.trial_ends_at).toBe(999);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- db`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/db.js`**

```js
import { randomId } from './util.js';

export async function createUser(DB, { email, pwHash = null, ip = null }) {
  const id = randomId();
  const now = Date.now();
  await DB.prepare('INSERT INTO users (id,email,pw_hash,created_at,signup_ip) VALUES (?,?,?,?,?)')
    .bind(id, email.toLowerCase(), pwHash, now, ip).run();
  return { id, email: email.toLowerCase(), created_at: now };
}
export async function getUserById(DB, id) {
  return DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();
}
export async function getUserByEmail(DB, email) {
  return DB.prepare('SELECT * FROM users WHERE email=?').bind(email.toLowerCase()).first();
}
export async function setPassword(DB, userId, pwHash) {
  await DB.prepare('UPDATE users SET pw_hash=? WHERE id=?').bind(pwHash, userId).run();
}
export async function getSubscription(DB, userId) {
  return DB.prepare('SELECT * FROM subscriptions WHERE user_id=?').bind(userId).first();
}
export async function upsertSubscription(DB, userId, { tier, status, trialEndsAt = null, periodEnd = null, helcimCustomerId = null, helcimPlanId = null }) {
  await DB.prepare(
    `INSERT INTO subscriptions (user_id,tier,status,trial_ends_at,current_period_end,helcim_customer_id,helcim_plan_id)
     VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(user_id) DO UPDATE SET tier=excluded.tier,status=excluded.status,
       trial_ends_at=excluded.trial_ends_at,current_period_end=excluded.current_period_end,
       helcim_customer_id=COALESCE(excluded.helcim_customer_id,subscriptions.helcim_customer_id),
       helcim_plan_id=COALESCE(excluded.helcim_plan_id,subscriptions.helcim_plan_id)`
  ).bind(userId, tier, status, trialEndsAt, periodEnd, helcimCustomerId, helcimPlanId).run();
}
export async function insertConsent(DB, userId, { termsVersion, ackVersion, quebecAttested }) {
  await DB.prepare('INSERT INTO consents (user_id,terms_version,ack_version,quebec_attested,ts) VALUES (?,?,?,?,?)')
    .bind(userId, termsVersion, ackVersion, quebecAttested ? 1 : 0, Date.now()).run();
}
export async function logAuthEvent(DB, { email = null, ip = null, type }) {
  await DB.prepare('INSERT INTO auth_events (id,email,ip,type,ts) VALUES (?,?,?,?,?)')
    .bind(randomId(), email, ip, type, Date.now()).run();
}
export async function recentAuthFailures(DB, email, sinceMs) {
  const r = await DB.prepare("SELECT COUNT(*) n FROM auth_events WHERE email=? AND type='login_fail' AND ts>?")
    .bind(email.toLowerCase(), Date.now() - sinceMs).first();
  return r?.n || 0;
}
// OAuth identity linking
export async function getOauthIdentity(DB, provider, providerUserId) {
  return DB.prepare('SELECT * FROM oauth_identities WHERE provider=? AND provider_user_id=?').bind(provider, providerUserId).first();
}
export async function linkOauthIdentity(DB, { provider, providerUserId, userId, email }) {
  await DB.prepare('INSERT OR IGNORE INTO oauth_identities (provider,provider_user_id,user_id,email,created_at) VALUES (?,?,?,?,?)')
    .bind(provider, providerUserId, userId, email, Date.now()).run();
}
// WebAuthn credentials
export async function addCredential(DB, { userId, credentialId, publicKey, counter, transports }) {
  await DB.prepare('INSERT INTO credentials (id,user_id,credential_id,public_key,counter,transports,created_at) VALUES (?,?,?,?,?,?,?)')
    .bind(randomId(), userId, credentialId, publicKey, counter, transports || null, Date.now()).run();
}
export async function getCredentialsByUser(DB, userId) {
  return (await DB.prepare('SELECT * FROM credentials WHERE user_id=?').bind(userId).all()).results || [];
}
export async function getCredentialById(DB, credentialId) {
  return DB.prepare('SELECT * FROM credentials WHERE credential_id=?').bind(credentialId).first();
}
export async function bumpCredentialCounter(DB, credentialId, counter) {
  await DB.prepare('UPDATE credentials SET counter=? WHERE credential_id=?').bind(counter, credentialId).run();
}
// WebAuthn challenges
export async function putChallenge(DB, { userId = null, challenge, type, ttlMs = 300000 }) {
  const id = randomId();
  await DB.prepare('INSERT INTO webauthn_challenges (id,user_id,challenge,type,expires_at) VALUES (?,?,?,?,?)')
    .bind(id, userId, challenge, type, Date.now() + ttlMs).run();
  return id;
}
export async function takeChallenge(DB, id) {
  const row = await DB.prepare('SELECT * FROM webauthn_challenges WHERE id=?').bind(id).first();
  if (row) await DB.prepare('DELETE FROM webauthn_challenges WHERE id=?').bind(id).run();
  if (!row || row.expires_at < Date.now()) return null;
  return row;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudflare-worker/src/db.js cloudflare-worker/test/db.test.js
git commit -m "feat(worker): D1 accessors for users/subs/consents/oauth/credentials/challenges"
```

---

## Task 4: Session (JWT sign/verify + cookie + point-read middleware + entitlement)

**Files:**
- Create: `cloudflare-worker/src/session.js`
- Test: `cloudflare-worker/test/session.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { migrate } from './helpers.js';
import { createUser, upsertSubscription } from '../src/db.js';
import { issueSession, verifySession, entitlement } from '../src/session.js';

beforeAll(() => migrate());
const SECRET = 'test-secret';

describe('session', () => {
  it('round-trips a signed token and point-reads a live user', async () => {
    const u = await createUser(env.DB, { email: 's@test.ca', pwHash: 'h', ip: '1' });
    const token = await issueSession(u.id, SECRET);
    const sess = await verifySession(token, SECRET, env.DB);
    expect(sess.user.id).toBe(u.id);
  });
  it('rejects a token for a deleted user (ghost-session)', async () => {
    const u = await createUser(env.DB, { email: 'ghost@test.ca', pwHash: 'h', ip: '1' });
    const token = await issueSession(u.id, SECRET);
    await env.DB.prepare('DELETE FROM users WHERE id=?').bind(u.id).run();
    expect(await verifySession(token, SECRET, env.DB)).toBeNull();
  });
  it('rejects a tampered/invalid token', async () => {
    expect(await verifySession('not.a.jwt', SECRET, env.DB)).toBeNull();
  });
  it('entitlement: active trial in future = entitled basic+', async () => {
    const u = await createUser(env.DB, { email: 'ent@test.ca', pwHash: 'h', ip: '1' });
    await upsertSubscription(env.DB, u.id, { tier: 'trial', status: 'active', trialEndsAt: Date.now() + 86400000 });
    const e = await entitlement(env.DB, u.id);
    expect(e.entitled).toBe(true);
    expect(e.tier).toBe('trial');
  });
  it('entitlement: expired trial = not entitled', async () => {
    const u = await createUser(env.DB, { email: 'exp@test.ca', pwHash: 'h', ip: '1' });
    await upsertSubscription(env.DB, u.id, { tier: 'trial', status: 'active', trialEndsAt: Date.now() - 1 });
    const e = await entitlement(env.DB, u.id);
    expect(e.entitled).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- session`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/session.js`**

```js
import { sign, verify } from 'hono/jwt';
import { setCookie, deleteCookie } from 'hono/cookie';
import { getUserById, getSubscription } from './db.js';

const THIRTY_DAYS = 60 * 60 * 24 * 30;
export const SESSION_COOKIE = 'mg_session';

export async function issueSession(userId, secret) {
  const now = Math.floor(Date.now() / 1000);
  return sign({ sub: userId, iat: now, exp: now + THIRTY_DAYS }, secret);
}

// signature-verify AND point-read the user row → deleted account is logged out everywhere
export async function verifySession(token, secret, DB) {
  if (!token) return null;
  let payload;
  try { payload = await verify(token, secret); } catch { return null; }
  const user = await getUserById(DB, payload.sub);
  if (!user) return null;
  return { user };
}

export function setSessionCookie(c, token) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: THIRTY_DAYS,
  });
}
export function clearSessionCookie(c) {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

// Hono middleware: attaches c.get('session') or 401s.
export function requireSession() {
  return async (c, next) => {
    const { getCookie } = await import('hono/cookie');
    const token = getCookie(c, SESSION_COOKIE);
    const sess = await verifySession(token, c.env.SESSION_SECRET, c.env.DB);
    if (!sess) return c.json({ error: 'not_signed_in' }, 401);
    c.set('session', sess);
    await next();
  };
}

// Resolve entitlement from the subscription row. Trial counts while trial_ends_at is in the future.
export async function entitlement(DB, userId) {
  const sub = await getSubscription(DB, userId);
  const now = Date.now();
  if (!sub) return { entitled: false, tier: null, status: 'none' };
  if (sub.tier === 'trial') {
    const live = sub.status === 'active' && sub.trial_ends_at && sub.trial_ends_at > now;
    return { entitled: !!live, tier: 'trial', status: live ? 'active' : 'expired', trialEndsAt: sub.trial_ends_at };
  }
  const live = sub.status === 'active' && (!sub.current_period_end || sub.current_period_end > now);
  return { entitled: !!live, tier: sub.tier, status: sub.status, periodEnd: sub.current_period_end };
}

// Route→minimum-tier map (Basic gets Research/Screener; Pro adds Charts/Models).
export const ROUTE_TIER = { research: 'basic', screener: 'basic', charts: 'pro', models: 'pro', positions: 'basic' };
export function tierRank(t) { return { trial: 2, basic: 1, pro: 2, null: 0 }[t] ?? 0; }
// trial grants full access during the window (treated as pro-level for gating).
export function meetsTier(userTier, needTier) {
  const rank = { basic: 1, pro: 2 };
  const have = userTier === 'trial' ? 2 : (rank[userTier] || 0);
  return have >= (rank[needTier] || 0);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- session`
Expected: PASS (5 tests). If `hono/jwt` verify throws on expiry rather than returning, the try/catch already handles it.

- [ ] **Step 5: Commit**

```bash
git add cloudflare-worker/src/session.js cloudflare-worker/test/session.test.js
git commit -m "feat(worker): JWT session with DB point-read (ghost-session-proof) + entitlement"
```

---

## Task 5: Legal/consent gate

**Files:**
- Create: `cloudflare-worker/src/legal.js`
- Test: `cloudflare-worker/test/legal.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { validateConsent } from '../src/legal.js';

const env = { TERMS_VERSION: '2026-07-08', ACK_VERSION: '2026-07-08' };

describe('legal', () => {
  it('accepts a full, non-Quebec consent', () => {
    const r = validateConsent({ acceptTerms: true, acceptAck: true, notQuebec: true }, env);
    expect(r.ok).toBe(true);
    expect(r.consent.quebecAttested).toBe(true);
  });
  it('blocks a Quebec resident', () => {
    const r = validateConsent({ acceptTerms: true, acceptAck: true, notQuebec: false }, env);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('quebec_not_available');
  });
  it('requires terms + ack', () => {
    expect(validateConsent({ acceptTerms: false, acceptAck: true, notQuebec: true }, env).ok).toBe(false);
    expect(validateConsent({ acceptTerms: true, acceptAck: false, notQuebec: true }, env).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- legal`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/legal.js`**

```js
export function validateConsent(body, env) {
  if (!body?.acceptTerms || !body?.acceptAck) {
    return { ok: false, error: 'consent_required' };
  }
  if (!body?.notQuebec) {
    return { ok: false, error: 'quebec_not_available' };
  }
  return {
    ok: true,
    consent: {
      termsVersion: env.TERMS_VERSION,
      ackVersion: env.ACK_VERSION,
      quebecAttested: true,
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- legal`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add cloudflare-worker/src/legal.js cloudflare-worker/test/legal.test.js
git commit -m "feat(worker): consent validation with Quebec exclusion"
```

---

## Task 6: Trial + anti-farming

**Files:**
- Create: `cloudflare-worker/src/trial.js`
- Test: `cloudflare-worker/test/trial.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { migrate } from './helpers.js';
import { createUser, getSubscription } from '../src/db.js';
import { startTrial, TRIAL_MS } from '../src/trial.js';

beforeAll(() => migrate());

describe('trial', () => {
  it('starts a 14-day trial and records the claim', async () => {
    const u = await createUser(env.DB, { email: 't1@test.ca', pwHash: 'h', ip: '9.9.9.9' });
    const r = await startTrial(env.DB, { userId: u.id, deviceId: 'devA', ip: '9.9.9.9' });
    expect(r.ok).toBe(true);
    const sub = await getSubscription(env.DB, u.id);
    expect(sub.tier).toBe('trial');
    expect(sub.trial_ends_at).toBeGreaterThan(Date.now() + TRIAL_MS - 5000);
  });
  it('refuses a second trial from the same device', async () => {
    const u2 = await createUser(env.DB, { email: 't2@test.ca', pwHash: 'h', ip: '8.8.8.8' });
    const r = await startTrial(env.DB, { userId: u2.id, deviceId: 'devA', ip: '8.8.8.8' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('trial_already_claimed');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- trial`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/trial.js`**

```js
import { upsertSubscription } from './db.js';

export const TRIAL_MS = 14 * 24 * 60 * 60 * 1000;
const IP_LIMIT = 3;         // max trials per IP
const IP_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export async function startTrial(DB, { userId, deviceId, ip }) {
  // one trial per device, ever
  if (deviceId) {
    const byDevice = await DB.prepare('SELECT COUNT(*) n FROM trial_claims WHERE device_id=?').bind(deviceId).first();
    if ((byDevice?.n || 0) > 0) return { ok: false, error: 'trial_already_claimed' };
  }
  // N per IP per window
  const byIp = await DB.prepare('SELECT COUNT(*) n FROM trial_claims WHERE ip=? AND created_at>?')
    .bind(ip, Date.now() - IP_WINDOW_MS).first();
  if ((byIp?.n || 0) >= IP_LIMIT) return { ok: false, error: 'trial_ip_limit' };

  const trialEndsAt = Date.now() + TRIAL_MS;
  await upsertSubscription(DB, userId, { tier: 'trial', status: 'active', trialEndsAt });
  await DB.prepare('INSERT INTO trial_claims (device_id,ip,user_id,created_at) VALUES (?,?,?,?)')
    .bind(deviceId || 'none', ip, userId, Date.now()).run();
  return { ok: true, trialEndsAt };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- trial`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add cloudflare-worker/src/trial.js cloudflare-worker/test/trial.test.js
git commit -m "feat(worker): 14-day trial with device+IP anti-farming"
```

---

## Task 7: Password auth routes (signup/login/logout/me) + device cookie

**Files:**
- Modify: `cloudflare-worker/src/auth_password.js`
- Test: `cloudflare-worker/test/auth_password.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, beforeAll } from 'vitest';
import app from '../src/index.js';
import { env } from 'cloudflare:test';
import { migrate, sessionCookie } from './helpers.js';

beforeAll(async () => { await migrate(); env.SESSION_SECRET = 'test-secret'; });

const signup = (body) => app.request('/api/auth/signup', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}, env);

describe('password auth', () => {
  const good = { email: 'user@test.ca', password: 'hunter2hunter2', acceptTerms: true, acceptAck: true, notQuebec: true };

  it('signup creates an account + trial + session and blocks Quebec', async () => {
    const res = await signup(good);
    expect(res.status).toBe(200);
    expect(sessionCookie(res)).toContain('mg_session=');
    const qc = await signup({ ...good, email: 'qc@test.ca', notQuebec: false });
    expect(qc.status).toBe(403);
    expect((await qc.json()).error).toBe('quebec_not_available');
  });

  it('rejects duplicate email', async () => {
    const res = await signup(good);
    expect(res.status).toBe(409);
  });

  it('login works with correct password, fails with wrong', async () => {
    const ok = await app.request('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@test.ca', password: 'hunter2hunter2' }),
    }, env);
    expect(ok.status).toBe(200);
    const bad = await app.request('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@test.ca', password: 'nope' }),
    }, env);
    expect(bad.status).toBe(401);
  });

  it('me returns entitlement for a signed-in user', async () => {
    const res = await signup({ ...good, email: 'me@test.ca' });
    const cookie = sessionCookie(res);
    const me = await app.request('/api/auth/me', { headers: { Cookie: cookie } }, env);
    expect(me.status).toBe(200);
    const body = await me.json();
    expect(body.email).toBe('me@test.ca');
    expect(body.entitlement.entitled).toBe(true); // fresh trial
  });

  it('me is 401 without a session', async () => {
    const me = await app.request('/api/auth/me', {}, env);
    expect(me.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- auth_password`
Expected: FAIL — routes not mounted.

- [ ] **Step 3: Implement `src/auth_password.js`**

```js
import { getCookie, setCookie } from 'hono/cookie';
import { hashPassword, verifyPassword, DUMMY_HASH } from './password.js';
import {
  createUser, getUserByEmail, getUserById, insertConsent, logAuthEvent, recentAuthFailures,
} from './db.js';
import { issueSession, setSessionCookie, clearSessionCookie, requireSession, entitlement } from './session.js';
import { validateConsent } from './legal.js';
import { startTrial } from './trial.js';
import { clientIp, randomId } from './util.js';

const DEVICE_COOKIE = 'mg_device';
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function ensureDevice(c) {
  let d = getCookie(c, DEVICE_COOKIE);
  if (!d) {
    d = randomId();
    setCookie(c, DEVICE_COOKIE, d, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 400 * 24 * 3600 });
  }
  return d;
}

export function mountPasswordAuth(app) {
  app.post('/api/auth/signup', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!EMAIL_RE.test(email)) return c.json({ error: 'invalid_email' }, 400);
    if (password.length < 10) return c.json({ error: 'weak_password' }, 400);

    const consent = validateConsent(body, c.env);
    if (!consent.ok) return c.json({ error: consent.error }, consent.error === 'quebec_not_available' ? 403 : 400);

    if (await getUserByEmail(c.env.DB, email)) return c.json({ error: 'email_taken' }, 409);

    const ip = clientIp(c.req.raw);
    const pwHash = await hashPassword(password);
    const user = await createUser(c.env.DB, { email, pwHash, ip });
    await insertConsent(c.env.DB, user.id, consent.consent);
    await logAuthEvent(c.env.DB, { email, ip, type: 'signup' });

    const deviceId = ensureDevice(c);
    await startTrial(c.env.DB, { userId: user.id, deviceId, ip }); // trial best-effort; failure just means no trial

    const token = await issueSession(user.id, c.env.SESSION_SECRET);
    setSessionCookie(c, token);
    return c.json({ ok: true, email });
  });

  app.post('/api/auth/login', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const ip = clientIp(c.req.raw);

    // per-email throttle: 8 failures / 15 min
    if (await recentAuthFailures(c.env.DB, email, 15 * 60 * 1000) >= 8) {
      await logAuthEvent(c.env.DB, { email, ip, type: 'rate_limited' });
      return c.json({ error: 'too_many_attempts' }, 429);
    }
    const user = await getUserByEmail(c.env.DB, email);
    // timing equalization: always run a verify even on unknown email / passwordless account
    const ok = await verifyPassword(password, user?.pw_hash || DUMMY_HASH);
    if (!user || !user.pw_hash || !ok) {
      await logAuthEvent(c.env.DB, { email, ip, type: 'login_fail' });
      return c.json({ error: 'invalid_credentials' }, 401);
    }
    await logAuthEvent(c.env.DB, { email, ip, type: 'login_ok' });
    ensureDevice(c);
    const token = await issueSession(user.id, c.env.SESSION_SECRET);
    setSessionCookie(c, token);
    return c.json({ ok: true, email });
  });

  app.post('/api/auth/logout', (c) => { clearSessionCookie(c); return c.json({ ok: true }); });

  app.get('/api/auth/me', requireSession(), async (c) => {
    const { user } = c.get('session');
    const ent = await entitlement(c.env.DB, user.id);
    return c.json({ id: user.id, email: user.email, entitlement: ent });
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- auth_password`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add cloudflare-worker/src/auth_password.js cloudflare-worker/test/auth_password.test.js
git commit -m "feat(worker): signup/login/logout/me with legal gate, trial, throttle, device cookie"
```

---

## Task 8: Google OAuth (start + callback, link-by-email)

**Files:**
- Modify: `cloudflare-worker/src/auth_oauth.js`
- Test: `cloudflare-worker/test/auth_oauth.test.js`

- [ ] **Step 1: Write the failing test** (mocks Google's token + userinfo endpoints via a fetch stub)

```js
import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import app from '../src/index.js';
import { env } from 'cloudflare:test';
import { migrate, sessionCookie } from './helpers.js';
import { getUserByEmail } from '../src/db.js';

beforeAll(async () => {
  await migrate();
  env.SESSION_SECRET = 'test-secret';
  env.GOOGLE_CLIENT_ID = 'cid';
  env.GOOGLE_CLIENT_SECRET = 'csecret';
  env.APP_URL = 'https://briefing.arshadkazi.ca';
});
afterEach(() => vi.restoreAllMocks());

describe('google oauth', () => {
  it('start redirects to Google with state cookie', async () => {
    const res = await app.request('/api/auth/oauth/google/start', {}, env);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('accounts.google.com');
    expect(res.headers.get('Set-Cookie')).toContain('mg_oauth_state=');
  });

  it('callback exchanges code, creates user, sets session', async () => {
    // first hit start to capture a valid state+cookie
    const start = await app.request('/api/auth/oauth/google/start', {}, env);
    const stateCookie = (start.headers.get('Set-Cookie').match(/mg_oauth_state=([^;]+)/))[1];
    const state = new URL(start.headers.get('Location')).searchParams.get('state');

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('oauth2.googleapis.com/token'))
        return new Response(JSON.stringify({ access_token: 'at' }), { status: 200 });
      if (String(url).includes('googleapis.com/oauth2/v3/userinfo'))
        return new Response(JSON.stringify({ sub: 'g-123', email: 'goog@test.ca', email_verified: true }), { status: 200 });
      throw new Error('unexpected fetch ' + url);
    });

    const res = await app.request(`/api/auth/oauth/google/callback?code=abc&state=${state}`,
      { headers: { Cookie: `mg_oauth_state=${stateCookie}` } }, env);
    expect(res.status).toBe(302);
    expect(sessionCookie(res)).toContain('mg_session=');
    expect(await getUserByEmail(env.DB, 'goog@test.ca')).toBeTruthy();
  });

  it('callback rejects mismatched state (CSRF)', async () => {
    const res = await app.request('/api/auth/oauth/google/callback?code=abc&state=evil',
      { headers: { Cookie: 'mg_oauth_state=other' } }, env);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- auth_oauth`
Expected: FAIL — routes not mounted.

- [ ] **Step 3: Implement `src/auth_oauth.js`**

```js
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { createUser, getUserByEmail, getOauthIdentity, linkOauthIdentity, logAuthEvent } from './db.js';
import { issueSession, setSessionCookie } from './session.js';
import { startTrial } from './trial.js';
import { clientIp, randomId } from './util.js';

const STATE_COOKIE = 'mg_oauth_state';
const DEVICE_COOKIE = 'mg_device';

export function mountOauth(app) {
  app.get('/api/auth/oauth/google/start', (c) => {
    const state = randomId();
    setCookie(c, STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 600 });
    const p = new URLSearchParams({
      client_id: c.env.GOOGLE_CLIENT_ID,
      redirect_uri: `${c.env.APP_URL}/api/auth/oauth/google/callback`,
      response_type: 'code',
      scope: 'openid email',
      state,
      prompt: 'select_account',
    });
    return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${p}`, 302);
  });

  app.get('/api/auth/oauth/google/callback', async (c) => {
    const url = new URL(c.req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const cookieState = getCookie(c, STATE_COOKIE);
    deleteCookie(c, STATE_COOKIE, { path: '/' });
    if (!code || !state || !cookieState || state !== cookieState) return c.json({ error: 'bad_state' }, 400);

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: c.env.GOOGLE_CLIENT_ID, client_secret: c.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${c.env.APP_URL}/api/auth/oauth/google/callback`, grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) return c.json({ error: 'token_exchange_failed' }, 400);
    const { access_token } = await tokenRes.json();

    const uiRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!uiRes.ok) return c.json({ error: 'userinfo_failed' }, 400);
    const profile = await uiRes.json();
    if (!profile.email || profile.email_verified === false) return c.json({ error: 'email_unverified' }, 400);

    const email = String(profile.email).toLowerCase();
    const ip = clientIp(c.req.raw);

    let identity = await getOauthIdentity(c.env.DB, 'google', profile.sub);
    let userId;
    if (identity) {
      userId = identity.user_id;
    } else {
      // link by verified email, else create
      const existing = await getUserByEmail(c.env.DB, email);
      const user = existing || (await createUser(c.env.DB, { email, pwHash: null, ip }));
      userId = user.id;
      await linkOauthIdentity(c.env.DB, { provider: 'google', providerUserId: profile.sub, userId, email });
      if (!existing) {
        await logAuthEvent(c.env.DB, { email, ip, type: 'signup' });
        const deviceId = getCookie(c, DEVICE_COOKIE) || randomId();
        setCookie(c, DEVICE_COOKIE, deviceId, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 400 * 24 * 3600 });
        await startTrial(c.env.DB, { userId, deviceId, ip });
      }
    }
    await logAuthEvent(c.env.DB, { email, ip, type: 'login_ok' });
    const token = await issueSession(userId, c.env.SESSION_SECRET);
    setSessionCookie(c, token);
    return c.redirect(`${c.env.APP_URL}/#/`, 302);
  });
}
```

> **Note on consent for OAuth signups:** Google users skip the signup form, so the legal gate is enforced on the FRONTEND before the OAuth redirect (Task 12 requires the Terms/ack/Quebec checkboxes ticked before enabling the "Continue with Google" button, and passes nothing to the server that would bypass it). Server records the consent on first `/api/auth/me` if missing — added in Task 12's frontend + a follow-up: if stricter server-side proof is needed, gate is revisited in Phase 3. For Phase 1, frontend-enforced consent + recorded attestation is the agreed bar (matches CompCeiling).

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- auth_oauth`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add cloudflare-worker/src/auth_oauth.js cloudflare-worker/test/auth_oauth.test.js
git commit -m "feat(worker): Google OAuth authorization-code flow with link-by-verified-email + CSRF state"
```

---

## Task 9: Passkeys (WebAuthn register + authenticate)

**Files:**
- Modify: `cloudflare-worker/src/auth_passkey.js`
- Test: `cloudflare-worker/test/auth_passkey.test.js`

- [ ] **Step 1: Write the failing test** (unit-level: options endpoints + verify wiring with `@simplewebauthn/server` mocked)

```js
import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import app from '../src/index.js';
import { env } from 'cloudflare:test';
import { migrate, sessionCookie } from './helpers.js';
import { createUser, getCredentialsByUser } from '../src/db.js';
import { issueSession } from '../src/session.js';
import * as swa from '@simplewebauthn/server';

beforeAll(async () => {
  await migrate();
  env.SESSION_SECRET = 'test-secret';
  env.RP_ID = 'briefing.arshadkazi.ca';
  env.RP_NAME = 'MapleGamma';
  env.APP_URL = 'https://briefing.arshadkazi.ca';
});
afterEach(() => vi.restoreAllMocks());

describe('passkey', () => {
  it('register/options requires a session', async () => {
    const res = await app.request('/api/auth/passkey/register/options', { method: 'POST' }, env);
    expect(res.status).toBe(401);
  });

  it('register/options returns a challenge for a signed-in user', async () => {
    const u = await createUser(env.DB, { email: 'pk@test.ca', pwHash: 'h', ip: '1' });
    const cookie = `mg_session=${await issueSession(u.id, env.SESSION_SECRET)}`;
    const res = await app.request('/api/auth/passkey/register/options', { method: 'POST', headers: { Cookie: cookie } }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.challenge).toBeTruthy();
    expect(body.challengeId).toBeTruthy();
  });

  it('register/verify stores a credential on success', async () => {
    const u = await createUser(env.DB, { email: 'pk2@test.ca', pwHash: 'h', ip: '1' });
    const cookie = `mg_session=${await issueSession(u.id, env.SESSION_SECRET)}`;
    const opts = await (await app.request('/api/auth/passkey/register/options', { method: 'POST', headers: { Cookie: cookie } }, env)).json();
    vi.spyOn(swa, 'verifyRegistrationResponse').mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: { id: 'cred-1', publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ['internal'] },
      },
    });
    const res = await app.request('/api/auth/passkey/register/verify', {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: opts.challengeId, response: { fake: true } }),
    }, env);
    expect(res.status).toBe(200);
    expect((await getCredentialsByUser(env.DB, u.id)).length).toBe(1);
  });

  it('login/verify issues a session on success', async () => {
    const u = await createUser(env.DB, { email: 'pk3@test.ca', pwHash: null, ip: '1' });
    await env.DB.prepare('INSERT INTO credentials (id,user_id,credential_id,public_key,counter,transports,created_at) VALUES (?,?,?,?,?,?,?)')
      .bind('row1', u.id, 'cred-9', btoa('key'), 0, 'internal', Date.now()).run();
    const optsRes = await app.request('/api/auth/passkey/login/options', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'pk3@test.ca' }),
    }, env);
    const opts = await optsRes.json();
    vi.spyOn(swa, 'verifyAuthenticationResponse').mockResolvedValue({ verified: true, authenticationInfo: { newCounter: 1 } });
    const res = await app.request('/api/auth/passkey/login/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: opts.challengeId, credentialId: 'cred-9', response: { fake: true } }),
    }, env);
    expect(res.status).toBe(200);
    expect(sessionCookie(res)).toContain('mg_session=');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- auth_passkey`
Expected: FAIL — routes not mounted.

- [ ] **Step 3: Implement `src/auth_passkey.js`**

```js
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { requireSession, issueSession, setSessionCookie } from './session.js';
import {
  getUserByEmail, addCredential, getCredentialsByUser, getCredentialById,
  bumpCredentialCounter, putChallenge, takeChallenge, logAuthEvent,
} from './db.js';
import { clientIp } from './util.js';

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export function mountPasskey(app) {
  // ── Registration (must be signed in) ──
  app.post('/api/auth/passkey/register/options', requireSession(), async (c) => {
    const { user } = c.get('session');
    const existing = await getCredentialsByUser(c.env.DB, user.id);
    const options = await generateRegistrationOptions({
      rpName: c.env.RP_NAME, rpID: c.env.RP_ID,
      userID: new TextEncoder().encode(user.id), userName: user.email,
      attestationType: 'none',
      excludeCredentials: existing.map((cr) => ({ id: cr.credential_id })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });
    const challengeId = await putChallenge(c.env.DB, { userId: user.id, challenge: options.challenge, type: 'register' });
    return c.json({ ...options, challengeId });
  });

  app.post('/api/auth/passkey/register/verify', requireSession(), async (c) => {
    const { user } = c.get('session');
    const { challengeId, response } = await c.req.json();
    const ch = await takeChallenge(c.env.DB, challengeId);
    if (!ch || ch.user_id !== user.id || ch.type !== 'register') return c.json({ error: 'bad_challenge' }, 400);
    let result;
    try {
      result = await verifyRegistrationResponse({
        response, expectedChallenge: ch.challenge,
        expectedOrigin: c.env.APP_URL, expectedRPID: c.env.RP_ID,
      });
    } catch { return c.json({ error: 'verify_failed' }, 400); }
    if (!result.verified || !result.registrationInfo) return c.json({ error: 'not_verified' }, 400);
    const cred = result.registrationInfo.credential;
    await addCredential(c.env.DB, {
      userId: user.id,
      credentialId: cred.id,
      publicKey: b64url(cred.publicKey),
      counter: cred.counter || 0,
      transports: (cred.transports || []).join(','),
    });
    return c.json({ ok: true });
  });

  // ── Authentication (not signed in) ──
  app.post('/api/auth/passkey/login/options', async (c) => {
    const { email } = await c.req.json();
    const user = email ? await getUserByEmail(c.env.DB, email) : null;
    const creds = user ? await getCredentialsByUser(c.env.DB, user.id) : [];
    const options = await generateAuthenticationOptions({
      rpID: c.env.RP_ID,
      allowCredentials: creds.map((cr) => ({ id: cr.credential_id, transports: (cr.transports || '').split(',').filter(Boolean) })),
      userVerification: 'preferred',
    });
    const challengeId = await putChallenge(c.env.DB, { userId: user?.id || null, challenge: options.challenge, type: 'login' });
    return c.json({ ...options, challengeId });
  });

  app.post('/api/auth/passkey/login/verify', async (c) => {
    const { challengeId, credentialId, response } = await c.req.json();
    const ch = await takeChallenge(c.env.DB, challengeId);
    if (!ch || ch.type !== 'login') return c.json({ error: 'bad_challenge' }, 400);
    const cred = await getCredentialById(c.env.DB, credentialId);
    if (!cred) return c.json({ error: 'unknown_credential' }, 400);
    let result;
    try {
      result = await verifyAuthenticationResponse({
        response, expectedChallenge: ch.challenge,
        expectedOrigin: c.env.APP_URL, expectedRPID: c.env.RP_ID,
        credential: { id: cred.credential_id, publicKey: unb64url(cred.public_key), counter: cred.counter },
      });
    } catch { return c.json({ error: 'verify_failed' }, 400); }
    if (!result.verified) return c.json({ error: 'not_verified' }, 400);
    await bumpCredentialCounter(c.env.DB, cred.credential_id, result.authenticationInfo.newCounter);
    await logAuthEvent(c.env.DB, { email: null, ip: clientIp(c.req.raw), type: 'login_ok' });
    const token = await issueSession(cred.user_id, c.env.SESSION_SECRET);
    setSessionCookie(c, token);
    return c.json({ ok: true });
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- auth_passkey`
Expected: PASS (4 tests). If `@simplewebauthn/server` v11 field names differ from the mock (`registrationInfo.credential`), align the mock + real access path to the installed version — verify against `node_modules/@simplewebauthn/server` types, do not assume.

- [ ] **Step 5: Commit**

```bash
git add cloudflare-worker/src/auth_passkey.js cloudflare-worker/test/auth_passkey.test.js
git commit -m "feat(worker): WebAuthn passkey register + authenticate ceremonies"
```

---

## Task 10: Mock billing interface + entitlement upgrade

**Files:**
- Modify: `cloudflare-worker/src/billing.js`
- Test: `cloudflare-worker/test/billing.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, beforeAll } from 'vitest';
import app from '../src/index.js';
import { env } from 'cloudflare:test';
import { migrate } from './helpers.js';
import { createUser, getSubscription } from '../src/db.js';
import { issueSession } from '../src/session.js';

beforeAll(async () => { await migrate(); env.SESSION_SECRET = 'test-secret'; env.MOCK_BILLING = '1'; });

describe('mock billing', () => {
  it('mock checkout activates the chosen tier for the signed-in user', async () => {
    const u = await createUser(env.DB, { email: 'buy@test.ca', pwHash: 'h', ip: '1' });
    const cookie = `mg_session=${await issueSession(u.id, env.SESSION_SECRET)}`;
    const res = await app.request('/api/billing/checkout', {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'pro' }),
    }, env);
    expect(res.status).toBe(200);
    const sub = await getSubscription(env.DB, u.id);
    expect(sub.tier).toBe('pro');
    expect(sub.status).toBe('active');
  });

  it('rejects an unknown tier', async () => {
    const u = await createUser(env.DB, { email: 'buy2@test.ca', pwHash: 'h', ip: '1' });
    const cookie = `mg_session=${await issueSession(u.id, env.SESSION_SECRET)}`;
    const res = await app.request('/api/billing/checkout', {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'diamond' }),
    }, env);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- billing`
Expected: FAIL — routes not mounted.

- [ ] **Step 3: Implement `src/billing.js`**

```js
import { requireSession } from './session.js';
import { upsertSubscription } from './db.js';

const TIERS = new Set(['basic', 'pro']);
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// Pluggable interface — Phase 3 swaps createCheckout/verifyWebhook for real Helcim.
export function mountBilling(app) {
  app.post('/api/billing/checkout', requireSession(), async (c) => {
    const { user } = c.get('session');
    const { tier } = await c.req.json().catch(() => ({}));
    if (!TIERS.has(tier)) return c.json({ error: 'invalid_tier' }, 400);

    if (c.env.MOCK_BILLING === '1') {
      // dev/mock: activate directly (Phase 3 will gate this to admin-only in prod, like CompCeiling)
      await upsertSubscription(c.env.DB, user.id, {
        tier, status: 'active', periodEnd: Date.now() + YEAR_MS,
      });
      return c.json({ ok: true, mock: true, tier });
    }
    // Phase 3: return a HelcimPay.js checkout session token here.
    return c.json({ error: 'billing_not_configured' }, 503);
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- billing`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add cloudflare-worker/src/billing.js cloudflare-worker/test/billing.test.js
git commit -m "feat(worker): mockable billing interface — mock checkout activates tier"
```

---

## Task 11: Apply migrations, set secrets, deploy the Worker

**Files:** none (ops)

- [ ] **Step 1: Apply migrations to the remote D1**

```bash
cd ~/morning-briefing/cloudflare-worker
npm run db:migrate:remote
```
Expected: applies `0001_init.sql` to the `maplegamma` D1.

- [ ] **Step 2: Set the session secret (generated, never typed by a human)**

```bash
head -c 48 /dev/urandom | base64 | npx wrangler secret put SESSION_SECRET
```

- [ ] **Step 3: Set the Google client secret (owner-provided, from a gitignored file — agent never sees it)**

```bash
# owner drops the value into ~/.hermes/.secrets/mg_google_client_secret (gitignored), then:
cat ~/.hermes/.secrets/mg_google_client_secret | npx wrangler secret put GOOGLE_CLIENT_SECRET
```
(If the owner prefers, they set it directly in the Cloudflare dashboard. `GOOGLE_CLIENT_ID` goes in `wrangler.toml [vars]`.)

- [ ] **Step 4: Deploy**

```bash
npx wrangler deploy
```
Expected: Worker deploys with the D1 binding.

- [ ] **Step 5: Smoke-check live endpoints**

```bash
curl -s https://briefing.arshadkazi.ca/api/health   # {"ok":true}
curl -s -X POST https://briefing.arshadkazi.ca/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"deploytest@dealer-demo.ca","password":"deploytest12","acceptTerms":true,"acceptAck":true,"notQuebec":true}' -i | grep -i set-cookie
```
Expected: `Set-Cookie: mg_session=...`. **Then delete this test account from the remote D1** (`wrangler d1 execute maplegamma --remote --command "DELETE FROM users WHERE email='deploytest@dealer-demo.ca'"`) — no stray prod accounts (per the never-test-in-prod rule).

> **Routing note:** `/api/*` and `/chat` must route to the Worker while `/` and `/data/*` stay on Pages. Confirm the Worker's route/custom-domain config covers `briefing.arshadkazi.ca/api/*` (add a Worker route pattern `briefing.arshadkazi.ca/api/*` and `/chat` in the CF dashboard if the Pages app is the zone's default). Verify `/data/latest.json` still serves from Pages after deploy.

---

## Task 12: Frontend — Auth module, account/pricing/paywall pages, route gating

**Files:**
- Create: `assets/js/auth.js`
- Create: `assets/js/pages/account.js`
- Create: `assets/js/pages/pricing.js`
- Create: `assets/js/pages/paywall.js`
- Create: `assets/js/vendor/simplewebauthn-browser.umd.min.js`
- Modify: `assets/js/router.js`
- Modify: `assets/js/app.js`
- Modify: `index.html`
- Create: `terms.html`, `privacy.html`

- [ ] **Step 1: Vendor the WebAuthn browser lib (CSP blocks CDN)**

```bash
cd ~/morning-briefing
curl -sL https://unpkg.com/@simplewebauthn/browser@11/dist/bundle/index.umd.min.js \
  -o assets/js/vendor/simplewebauthn-browser.umd.min.js
```
Verify it defines `window.SimpleWebAuthnBrowser`.

- [ ] **Step 2: Write `assets/js/auth.js`**

```js
const API = ''; // same origin
const Auth = {
  _me: undefined,
  async me(force = false) {
    if (this._me !== undefined && !force) return this._me;
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      this._me = res.ok ? await res.json() : null;
    } catch { this._me = null; }
    return this._me;
  },
  async signup(payload) {
    const res = await fetch('/api/auth/signup', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    this._me = undefined;
    return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
  },
  async login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
    });
    this._me = undefined;
    return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
  },
  async logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    this._me = null;
    window.location.hash = '#/';
  },
  googleStart() { window.location.href = '/api/auth/oauth/google/start'; },

  async passkeyRegister() {
    const opts = await (await fetch('/api/auth/passkey/register/options', { method: 'POST', credentials: 'include' })).json();
    const att = await SimpleWebAuthnBrowser.startRegistration(opts);
    const res = await fetch('/api/auth/passkey/register/verify', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ challengeId: opts.challengeId, response: att }),
    });
    return res.ok;
  },
  async passkeyLogin(email) {
    const opts = await (await fetch('/api/auth/passkey/login/options', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
    })).json();
    const asrt = await SimpleWebAuthnBrowser.startAuthentication(opts);
    const res = await fetch('/api/auth/passkey/login/verify', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: opts.challengeId, credentialId: asrt.id, response: asrt }),
    });
    this._me = undefined;
    return res.ok;
  },

  // Guard used by paid routes. Returns true if allowed to render.
  async guard(needTier) {
    const me = await this.me();
    if (!me) { window.location.hash = '#/account'; return false; }
    const e = me.entitlement || {};
    const rank = { basic: 1, pro: 2 };
    const have = e.tier === 'trial' && e.entitled ? 2 : (e.entitled ? (rank[e.tier] || 0) : 0);
    if (have < (rank[needTier] || 0)) { window.location.hash = '#/pricing'; return false; }
    return true;
  },
};
window.Auth = Auth;
```

- [ ] **Step 3: Allow an async guard in `assets/js/router.js`**

Modify the route handler dispatch so a route registered with a guard runs `await guard()` first and aborts render if it returns false. Concretely, change `Router.register` to accept `(path, handler, guard)` and, in the resolver, do:
```js
// inside the matched-route branch, before calling handler(app, params):
if (entry.guard) {
  const ok = await entry.guard();
  if (!ok) return; // guard already redirected
}
```
Store `{ handler, guard }` per path instead of a bare handler.

- [ ] **Step 4: Register gated routes + new pages in `assets/js/app.js`**

```js
Router.register('/account',  (app) => Account.render(app));
Router.register('/pricing',  (app) => Pricing.render(app));
Router.register('/positions', (app) => PaperTrades.render(app), () => Auth.guard('basic'));
Router.register('/research',  (app) => Research.render(app),   () => Auth.guard('basic'));
Router.register('/screener',  (app) => Screener.render(app),   () => Auth.guard('basic'));
Router.register('/charts',    (app) => Charts.render(app),     () => Auth.guard('pro'));
Router.register('/models',    (app) => Models.render(app),     () => Auth.guard('pro'));
```
(Dashboard `/` and `/options` stay ungated — free.)

- [ ] **Step 5: Write `assets/js/pages/account.js`** — signup + login with all three methods and the legal gate

```js
const Account = {
  async render(app) {
    const me = await Auth.me();
    if (me) { app.innerHTML = `<div class="section"><p>Signed in as ${me.email}. <a href="#/pricing">Manage plan</a> · <a href="#" id="lo">Log out</a></p></div>`;
      app.querySelector('#lo').onclick = (e) => { e.preventDefault(); Auth.logout(); }; return; }
    app.innerHTML = `
      <div class="section" style="max-width:460px;margin:0 auto">
        <h2 class="section-title">Sign in / Create account</h2>
        <div id="msg" style="color:var(--red);font-size:.85rem;min-height:1.2em"></div>
        <input id="email" placeholder="Email" style="width:100%;margin:6px 0;padding:10px">
        <input id="pw" type="password" placeholder="Password (10+ chars)" style="width:100%;margin:6px 0;padding:10px">
        <div id="legal" style="font-size:.8rem;margin:10px 0;line-height:1.6">
          <label><input type="checkbox" id="cTerms"> I accept the <a href="/terms.html" target="_blank">Terms</a> & <a href="/privacy.html" target="_blank">Privacy Policy</a></label><br>
          <label><input type="checkbox" id="cAck"> I understand this is general information, not investment advice, paper-only; past performance ≠ future results</label><br>
          <label><input type="checkbox" id="cQC"> I am not a resident of Quebec</label>
        </div>
        <button id="signup" class="btn">Create account</button>
        <button id="login" class="btn">Log in</button>
        <hr style="margin:16px 0">
        <button id="google" class="btn">Continue with Google</button>
        <button id="pkLogin" class="btn">Sign in with a passkey</button>
      </div>`;
    const v = (id) => app.querySelector(id).value.trim();
    const chk = (id) => app.querySelector(id).checked;
    const msg = (t) => { app.querySelector('#msg').textContent = t; };
    const consentOk = () => chk('#cTerms') && chk('#cAck') && chk('#cQC');

    app.querySelector('#signup').onclick = async () => {
      if (!consentOk()) return msg('Please accept the terms and confirm you are not in Quebec.');
      const r = await Auth.signup({ email: v('#email'), password: v('#pw'), acceptTerms: true, acceptAck: true, notQuebec: true });
      if (r.ok) window.location.hash = '#/'; else msg(errText(r.body.error));
    };
    app.querySelector('#login').onclick = async () => {
      const r = await Auth.login(v('#email'), v('#pw'));
      if (r.ok) window.location.hash = '#/'; else msg(errText(r.body.error));
    };
    app.querySelector('#google').onclick = () => {
      if (!consentOk()) return msg('Please accept the terms and confirm you are not in Quebec before continuing with Google.');
      Auth.googleStart();
    };
    app.querySelector('#pkLogin').onclick = async () => {
      const ok = await Auth.passkeyLogin(v('#email')); if (ok) window.location.hash = '#/'; else msg('Passkey sign-in failed.');
    };
    function errText(e) {
      return ({ email_taken: 'That email already has an account — log in instead.',
        quebec_not_available: 'Sorry, this service is not available to Quebec residents.',
        weak_password: 'Password must be at least 10 characters.',
        invalid_credentials: 'Wrong email or password.', too_many_attempts: 'Too many attempts — try again later.' }[e]) || 'Something went wrong.';
    }
  },
};
window.Account = Account;
```

- [ ] **Step 6: Write `assets/js/pages/pricing.js`** (public) — Free / Basic / Pro with mock-checkout buttons

```js
const Pricing = {
  async render(app) {
    const me = await Auth.me();
    const buy = async (tier) => {
      if (!me) { window.location.hash = '#/account'; return; }
      const res = await fetch('/api/billing/checkout', { method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier }) });
      if (res.ok) { Auth._me = undefined; window.location.hash = '#/'; }
      else alert('Checkout unavailable right now.');
    };
    app.innerHTML = `
      <div class="section"><h2 class="section-title">Plans</h2>
      <div class="grid-3">
        <div class="card"><div class="card-title">Free</div><p>Daily dashboard: regime, indices, headlines, Reddit pulse, GEX snapshot.</p></div>
        <div class="card"><div class="card-title">Basic</div><p>+ Research & Screener.</p><button class="btn" data-t="basic">Choose Basic</button></div>
        <div class="card"><div class="card-title">Pro</div><p>+ Charts & Models (and future alerts).</p><button class="btn" data-t="pro">Choose Pro</button></div>
      </div>
      <p style="font-size:.75rem;color:var(--text-muted);margin-top:12px">Prices shown at checkout. 14-day free trial on signup. Not investment advice.</p>
      </div>`;
    app.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => buy(b.dataset.t)));
  },
};
window.Pricing = Pricing;
```

- [ ] **Step 7: Write `assets/js/pages/paywall.js`** (interstitial the guards fall back to is `#/pricing`; this module renders an inline upsell used by teased sections later — minimal for Phase 1)

```js
const Paywall = {
  html(needTier) {
    return `<div class="section"><div class="card" style="text-align:center;padding:32px">
      <div class="card-title">This is a ${needTier === 'pro' ? 'Pro' : 'Basic'} feature</div>
      <p>Start your 14-day free trial or upgrade to view.</p>
      <a class="btn" href="#/pricing">See plans</a> <a class="btn" href="#/account">Sign in</a>
    </div></div>`;
  },
};
window.Paywall = Paywall;
```

- [ ] **Step 8: Wire scripts + nav into `index.html`**

Add before `app.js` in the script list:
```html
<script src="/assets/js/vendor/simplewebauthn-browser.umd.min.js"></script>
<script src="/assets/js/auth.js"></script>
<script src="/assets/js/pages/account.js"></script>
<script src="/assets/js/pages/pricing.js"></script>
<script src="/assets/js/pages/paywall.js"></script>
```
Add an auth affordance to the nav (Sign in / account email) — a small script that calls `Auth.me()` on load and renders a `#/account` link or the email.

- [ ] **Step 9: Create `terms.html` + `privacy.html`**

Adapt the CompCeiling `/terms` and `/privacy` drafts (general info / not-advice / paper-only / Quebec-excluded / data-may-be-delayed). Plain static HTML matching the site shell.

- [ ] **Step 10: Manual verification in the browser (dev)**

Run: `cd ~/morning-briefing/cloudflare-worker && npx wrangler dev` (serves `/api/*` locally) and serve the static site (or test against the deployed Worker).
Verify: signup with all 3 boxes → lands on dashboard; visiting `#/charts` while on trial renders; after `DELETE`ing the sub row, `#/charts` redirects to `#/pricing`; "Continue with Google" is blocked until boxes checked; passkey register (from a signed-in session) then passkey login works on a supported device.

- [ ] **Step 11: Commit**

```bash
cd ~/morning-briefing
git add assets/js/auth.js assets/js/pages/ assets/js/vendor/simplewebauthn-browser.umd.min.js assets/js/router.js assets/js/app.js index.html terms.html privacy.html
git commit -m "feat(site): auth module + account/pricing/paywall pages + route gating (email/OAuth/passkey)"
```

---

## Task 13: SEO/robots/llms update for gated routes

**Files:**
- Modify: `robots.txt`, `llms.txt`, `sitemap.xml`

- [ ] **Step 1: Keep only public routes discoverable**

`sitemap.xml`: list `/`, `/#/pricing`, `/terms.html`, `/privacy.html` only. `robots.txt`: keep crawlers allowed for public pages; do not advertise `/api/*` or gated data. `llms.txt`: describe the free Dashboard + pricing; remove the now-private `/data/*.json` endpoints that become gated in Phase 2 (note them as "subscription-gated" rather than listing open URLs).

- [ ] **Step 2: Commit**

```bash
git add robots.txt llms.txt sitemap.xml
git commit -m "docs(seo): reflect gated routes — public pages only in sitemap/llms"
```

---

## Task 14: Deploy frontend + end-to-end verification

- [ ] **Step 1: Push frontend (Pages auto-deploy)**

```bash
cd ~/morning-briefing && git push origin main
```

- [ ] **Step 2: Verify live**

- `#/account` renders the 3-method form.
- Signup (non-Quebec) → dashboard; `/api/auth/me` returns `entitlement.entitled=true` (trial).
- `#/charts` renders on trial; after trial expiry (simulate by setting `trial_ends_at` in the past via `wrangler d1 execute ... --remote`), `#/charts` → `#/pricing`.
- "Continue with Google" round-trips (needs the owner's web client live).
- Passkey register + login on a real device.
- Free Dashboard still fully works logged-out.
- Purge any test accounts created during verification from the remote D1.

- [ ] **Step 3: Update memory**

Add a `project_maplegamma_paywall.md` memory: repo, Worker/D1 names, the 3-auth decision, MOCK_BILLING state, the ghost-session-proof session design, and that Phases 2 (R2 hard-gate) + 3 (Helcim) remain, with real billing gated on legal review.

---

## Self-Review (completed against the spec)

- **Spec §1 Auth & session** → Tasks 4,7,8,9 (session + all three methods); point-read in Task 4; per-email throttle + dummy-hash in Task 7. ✅ (extends spec from password-only to all three per user decision.)
- **Spec §2 D1 store** → Task 1 schema covers users/subscriptions/trial_claims/consents/auth_events + added `oauth_identities`, `credentials`, `webauthn_challenges` for the extra methods. ✅
- **Spec §3 Gating** → Phase 1 delivers the **UX gate** (Task 12 guards). The **hard R2 data gate is Phase 2** (separate plan) — called out, not silently dropped. ✅
- **Spec §4 Trial + anti-farming** → Task 6 (device + IP). ✅
- **Spec §5 Helcim billing (pluggable, mock)** → Task 10 mock interface; real Helcim = Phase 3. ✅
- **Spec §6 Legal gate** → Task 5 + Task 12 (checkboxes) + terms/privacy pages; Quebec excluded. ✅
- **Spec SEO impact** → Task 13. ✅
- **Placeholder scan:** all code steps contain full code; ops steps contain exact commands. No TODO/TBD.
- **Type consistency:** `entitlement()` shape `{entitled,tier,status,...}` used consistently in session.js, auth_password.js, auth.js. `mountX(app)` names match index.js imports. Challenge API `putChallenge`/`takeChallenge` consistent across db.js + passkey.
- **Known verify-at-build items flagged (not asserted):** `@simplewebauthn/server` v11 field names (Task 9 Step 4), Worker route patterns for `/api/*` vs Pages (Task 11 note), `hono/jwt` expiry-throw behavior (Task 4 Step 4).

## Deferred to later plans
- **Phase 2 plan:** private R2 bucket, `/api/data/:file` hard gate, `screener-lite.json` split, Pi `push_dashboard.py` R2 upload, frontend private-fetch path.
- **Phase 3 plan:** concrete Helcim (HelcimPay.js modal, recurring plan, webhook lifecycle, trial→paid), admin-only mock in prod, real billing gated on legal review.
- Password reset emails, email verification (YAGNI for v1 per spec non-goals).
