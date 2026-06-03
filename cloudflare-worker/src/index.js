/**
 * Cloudflare Worker — Chat API proxy to OpenRouter with live data.
 *
 * POST /chat    { ticker, eli5? } → OpenRouter analysis + live yfinance data
 * GET  /turso   { query }         → Query Turso for historical context
 */
const rateLimitStore = {};

function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60_000;
  const maxRequests = 10;
  if (!rateLimitStore[ip]) rateLimitStore[ip] = [];
  rateLimitStore[ip] = rateLimitStore[ip].filter(ts => now - ts < windowMs);
  if (rateLimitStore[ip].length >= maxRequests) return false;
  rateLimitStore[ip].push(now);
  return true;
}

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
});

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

// ─── Live yfinance data ──────────────────────────────────────
async function fetchLiveData(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1mo`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    const c = data?.chart?.result?.[0];
    if (!c) return null;
    const meta = c.meta || {};
    const quotes = c.indicators?.quote?.[0] || {};
    const closes = (quotes.close || []).filter(v => v != null);
    const prevClose = closes.length >= 2 ? closes[closes.length - 2] : null;
    const change = meta.regularMarketPrice != null && prevClose != null
      ? ((meta.regularMarketPrice - prevClose) / prevClose * 100) : null;
    return {
      price: meta.regularMarketPrice,
      prevClose,
      change,
      high: meta.regularDayHigh || meta.chartPreviousClose,
      low: meta.regularDayLow || meta.chartPreviousClose,
      volume: meta.regularMarketVolume,
      currency: meta.currency,
      exchange: meta.exchangeName,
    };
  } catch { return null; }
}

// ─── Turso query ─────────────────────────────────────────────
async function queryTurso(sql, tursoUrl, tursoToken) {
  if (!tursoUrl || !tursoToken) return null;
  try {
    const res = await fetch(`${tursoUrl}/v2/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tursoToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql } }] }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ─── Prompts ─────────────────────────────────────────────────
const PROMPT_NORMAL = `You are a professional financial analyst. Generate a comprehensive analysis for the given ticker.

Use REAL data from the context provided (price, change, RSI, etc.) — never hallucinate numbers.

Return markdown with this structure:

## 📊 Price & Technicals
| Metric | Value |
|--------|-------|
| Current Price | $X.XX |
| Daily Change | +X.XX% |
| ... | ... |

## 📈 Technical Analysis
Brief paragraph about trend, support/resistance, RSI interpretation.

## ⚡ Key Catalysts
What's driving the stock right now — earnings, sector trends, news.

## ⚠️ Risk Factors
What could go wrong.

## 🎯 Verdict
**Bullish / Bearish / Neutral** — one sentence verdict with key reasoning.

IMPORTANT: Return ONLY the markdown. No preamble like "Here's your analysis". Use tables where possible. Be specific with numbers from the context data.`;

const PROMPT_ELI5 = `You are explaining stock analysis to a beginner trader. Use simple language — no jargon without explaining it first.

Use the real data from the context (price, change, etc.).

Return markdown with:

## What's Happening with [TICKER]
In plain English, 2-3 sentences.

## The Numbers
| What | Number | What It Means |
|------|--------|---------------|
| Price | $X | This is what 1 share costs |
| Change | +X% | It went up/down this much today |
| ... | ... | ... |

## The Simple Verdict
**👍 Looks Good / 👎 Looks Risky / 🤷 Hard to Say**
Explain in 1-2 simple sentences why.

Keep it friendly and educational. No assumptions about prior knowledge.`;

// ─── Main handler ────────────────────────────────────────────
async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // ── Turso proxy ──
  if (path === '/turso' && request.method === 'POST') {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(ip)) return json({ error: 'Rate limited' }, 429);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

    const result = await queryTurso(body.sql, env.TURSO_URL, env.TURSO_TOKEN);
    return json({ result });
  }

  // ── Chat ──
  if (path === '/' || path === '/chat') {
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(ip)) return json({ error: 'Rate limited. 10 req/min.' }, 429);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

    const ticker = (body?.ticker || '').trim().toUpperCase();
    if (!ticker || !/^[A-Z]{1,5}$/.test(ticker)) {
      return json({ error: 'Invalid ticker. Use 1-5 letters (e.g., AAPL).' }, 400);
    }

    const apiKey = env?.OPENROUTER_API_KEY;
    if (!apiKey) return json({ error: 'API key not configured' }, 500);

    const model = env?.OPENROUTER_MODEL || 'deepseek/deepseek-v4-pro';
    const baseUrl = env?.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    const isELI5 = body?.eli5 === true;
    const systemPrompt = isELI5 ? PROMPT_ELI5 : PROMPT_NORMAL;

    // Fetch live data
    const liveData = await fetchLiveData(ticker);

    // Build user prompt with context
    let contextLines = [`Analyze ticker: ${ticker}`];
    if (liveData) {
      contextLines.push(``);
      contextLines.push(`Live market data for ${ticker}:`);
      contextLines.push(`- Price: $${liveData.price}`);
      if (liveData.change != null) contextLines.push(`- Change: ${liveData.change >= 0 ? '+' : ''}${liveData.change.toFixed(2)}%`);
      contextLines.push(`- Volume: ${liveData.volume?.toLocaleString() || 'N/A'}`);
      contextLines.push(`- Exchange: ${liveData.exchange || 'N/A'}`);
      contextLines.push(`- Currency: ${liveData.currency || 'USD'}`);
    }
    contextLines.push(``);
    contextLines.push(`Provide a detailed analysis with tables. ${isELI5 ? 'Explain it simply like I am new to trading.' : ''}`);
    const userPrompt = contextLines.join('\n');

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://morningbriefing.pages.dev',
          'X-Title': 'Morning Briefing Chat',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return json({ error: `OpenRouter error: ${response.status}` }, 502);
      }

      const result = await response.json();
      const content = result?.choices?.[0]?.message?.content || 'No analysis generated.';

      // Build context block with live data shown on site
      let contextBlock = '';
      if (liveData) {
        const cls = liveData.change >= 0 ? 'positive' : 'negative';
        const sign = liveData.change >= 0 ? '+' : '';
        contextBlock = `\n\n<div class="live-data-card" style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:16px;font-size:0.85rem">
          <span style="color:var(--text-muted)">Live Data · </span>
          <strong>${ticker}</strong>
          <span style="margin-left:12px">$${liveData.price}</span>
          <span class="${cls}" style="margin-left:8px">${sign}${liveData.change?.toFixed(2)}%</span>
          <span style="margin-left:12px;color:var(--text-muted)">Vol: ${(liveData.volume / 1e6).toFixed(1)}M</span>
        </div>`;
      }

      return json({
        ticker,
        content,
        contextBlock,
        model: result?.model || model,
        liveData,
        usage: result?.usage || null,
      });
    } catch (err) {
      return json({ error: 'Internal server error' }, 500);
    }
  }

  return json({ error: 'Not found' }, 404);
}

export default { fetch: handleRequest };
