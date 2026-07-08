import { Hono } from 'hono';
import { handleChat } from './chat.js';
import { handleFeedback } from './feedback.js';
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
app.post('/feedback', (c) => handleFeedback(c.req.raw, c.env));
mountPasswordAuth(app);
mountOauth(app);
mountPasskey(app);
mountBilling(app);

app.get('/api/health', (c) => c.json({ ok: true }));

export default app;
