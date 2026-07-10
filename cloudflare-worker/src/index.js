import { Hono } from 'hono';
import { handleChat } from './chat.js';
import { handleFeedback } from './feedback.js';
import { getOrigin } from './util.js';
import { mountPasswordAuth } from './auth_password.js';
import { mountOauth } from './auth_oauth.js';
import { mountPasskey } from './auth_passkey.js';
import { mountBilling } from './billing.js';
import { mountDataGate } from './data_gate.js';

const app = new Hono();

// ── Canonical-host redirect ──────────────────────────────────────────────
// maplegamma.com is the primary domain. 301 every request on the legacy /
// alternate hosts to it (path + query preserved) so shared links and SEO
// equity consolidate on one domain. Runs first, before anything else.
const CANONICAL_HOST = 'maplegamma.com';
const REDIRECT_HOSTS = new Set([
  'maplegamma.ca', 'www.maplegamma.ca',
  'briefing.arshadkazi.ca', 'maplegamma.arshadkazi.ca',
]);
app.use('*', async (c, next) => {
  const url = new URL(c.req.url);
  if (REDIRECT_HOSTS.has(url.hostname)) {
    return c.redirect('https://' + CANONICAL_HOST + url.pathname + url.search, 301);
  }
  await next();
});

app.use('*', async (c, next) => {
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

app.post('/', (c) => handleChat(c.req.raw, c.env));
app.post('/chat', (c) => handleChat(c.req.raw, c.env));
app.post('/feedback', (c) => handleFeedback(c.req.raw, c.env));
mountPasswordAuth(app);
mountOauth(app);
mountPasskey(app);
mountBilling(app);
mountDataGate(app);

app.get('/api/health', (c) => c.json({ ok: true }));

export default app;
