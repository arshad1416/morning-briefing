/**
 * Cloudflare Worker — Chat API proxy to OpenRouter with live data.
 * POST /chat  { ticker, eli5? } → OpenRouter analysis + live yfinance data
 * POST /turso { sql }           → Query Turso for historical context
 */
const rateLimitStore = {};
function checkRateLimit(ip) {
  const now = Date.now(), w = 60_000, m = 10;
  if (!rateLimitStore[ip]) rateLimitStore[ip] = [];
  rateLimitStore[ip] = rateLimitStore[ip].filter(t => now - t < w);
  if (rateLimitStore[ip].length >= m) return false;
  rateLimitStore[ip].push(now); return true;
}
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

async function fetchLiveData(ticker) {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1mo`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const c = (await res.json())?.chart?.result?.[0]; if (!c) return null;
    const m = c.meta || {};
    const closes = (c.indicators?.quote?.[0]?.close || []).filter(v => v != null);
    const prev = closes.length >= 2 ? closes[closes.length - 2] : null;
    const chg = m.regularMarketPrice != null && prev != null ? ((m.regularMarketPrice - prev) / prev * 100) : null;
    return { price: m.regularMarketPrice, prevClose: prev, change: chg, volume: m.regularMarketVolume, currency: m.currency, exchange: m.exchangeName };
  } catch { return null; }
}

async function queryTurso(sql, url, token) {
  if (!url || !token) return null;
  try {
    const res = await fetch(url.replace('libsql:', 'https:') + '/v2/pipeline', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql } }] }),
    });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

const PROMPT_NORMAL = `You are a professional financial analyst. Generate a comprehensive analysis for the given ticker.
Use REAL data from the context provided — never hallucinate numbers.
Return markdown: ## Price & Technicals (table), ## Technical Analysis, ## Key Catalysts, ## Risk Factors, ## Verdict.
IMPORTANT: Return ONLY the markdown. No preamble. Use tables.`;

const PROMPT_ELI5 = `You are explaining stock analysis to a beginner trader. Use simple language, no jargon.
Return markdown: ## What's Happening (plain English), ## The Numbers (table with "what it means" column), ## The Simple Verdict.
Keep it friendly and educational.`;

async function handleRequest(request, env) {
  const url = new URL(request.url), path = url.pathname;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });

  // ── Turso proxy ──
  if (path === '/turso' && request.method === 'POST') {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(ip)) return json({ error: 'Rate limited' }, 429);
    let body; try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    const result = await queryTurso(body.sql, env.TURSO_URL, env.TURSO_TOKEN);
    return json({ result });
  }

  // ── Chat ──
  if ((path === '/' || path === '/chat') && request.method === 'POST') {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(ip)) return json({ error: 'Rate limited' }, 429);
    let body; try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    const ticker = (body?.ticker || '').trim().toUpperCase();
    if (!ticker || !/^[A-Z]{1,5}$/.test(ticker)) return json({ error: 'Invalid ticker' }, 400);
    const apiKey = env?.OPENROUTER_API_KEY; if (!apiKey) return json({ error: 'API key not configured' }, 500);
    const model = env?.OPENROUTER_MODEL || 'deepseek/deepseek-v4-pro';
    const baseUrl = env?.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    const isELI5 = body?.eli5 === true;
    const liveData = await fetchLiveData(ticker);
    let ctx = [`Analyze ticker: ${ticker}`];
    if (liveData) {
      ctx.push(`Live price: $${liveData.price}`, liveData.change != null ? `Change: ${liveData.change >= 0 ? '+' : ''}${liveData.change.toFixed(2)}%` : '');
      ctx.push(`Volume: ${(liveData.volume / 1e6).toFixed(1)}M`);
    }
    ctx.push(isELI5 ? 'Explain simply.' : 'Provide detailed analysis with tables.');
    try {
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://morningbriefing.pages.dev', 'X-Title': 'Morning Briefing Chat' },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: isELI5 ? PROMPT_ELI5 : PROMPT_NORMAL }, { role: 'user', content: ctx.join('\n') }], temperature: 0.3, max_tokens: 2000 }),
      });
      if (!resp.ok) return json({ error: `OpenRouter error: ${resp.status}` }, 502);
      const result = await resp.json();
      const content = result?.choices?.[0]?.message?.content || 'No analysis.';
      let ctxBlock = '';
      if (liveData) {
        const sign = liveData.change >= 0 ? '+' : '';
        ctxBlock = `<div class="live-data-card">${ticker} $${liveData.price} ${sign}${liveData.change?.toFixed(2)}% Vol: ${(liveData.volume / 1e6).toFixed(1)}M</div>`;
      }
      return json({ ticker, content, contextBlock: ctxBlock, model: result?.model || model, liveData });
    } catch { return json({ error: 'Internal error' }, 500); }
  }
  return json({ error: 'Not found' }, 404);
}
export default { fetch: handleRequest };
