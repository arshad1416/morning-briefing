/**
 * Cloudflare Worker — Chat API proxy to OpenRouter with live data.
 * POST /chat  { ticker, eli5? } → OpenRouter analysis + live yfinance data
 *
 * SECURITY: No SQL proxy. All DB queries use typed, predefined endpoints.
 */

const ALLOWED_ORIGINS = [
  'https://briefing.arshadkazi.ca',
  /^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.morningbriefing\.pages\.dev$/,
];

function getOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return 'https://briefing.arshadkazi.ca';
  // exact match or regex match
  if (
    ALLOWED_ORIGINS.some((o) =>
      typeof o === 'string' ? o === origin : o.test(origin),
    )
  )
    return origin;
  return 'https://briefing.arshadkazi.ca'; // fallback
}

const json = (d, s = 200, request = null) => {
  const origin = request ? getOrigin(request) : 'https://briefing.arshadkazi.ca';
  return new Response(JSON.stringify(d), {
    status: s,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
    },
  });
};

async function fetchLiveData(ticker) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1mo`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
    if (!res.ok) return null;
    const c = (await res.json())?.chart?.result?.[0];
    if (!c) return null;
    const m = c.meta || {};
    const closes = (c.indicators?.quote?.[0]?.close || []).filter((v) => v != null);
    const prev = closes.length >= 2 ? closes[closes.length - 2] : null;
    const chg =
      m.regularMarketPrice != null && prev != null
        ? ((m.regularMarketPrice - prev) / prev) * 100
        : null;
    return {
      price: m.regularMarketPrice,
      prevClose: prev,
      change: chg,
      volume: m.regularMarketVolume,
      currency: m.currency,
      exchange: m.exchangeName,
    };
  } catch {
    return null;
  }
}

const PROMPT_NORMAL = `You are a professional financial analyst. Generate a comprehensive analysis for the given ticker.
Use REAL data from the context provided — never hallucinate numbers.
Return markdown: ## Price & Technicals (table), ## Technical Analysis, ## Key Catalysts, ## Risk Factors, ## Verdict.
IMPORTANT: Return ONLY the markdown. No preamble. Use tables.`;

const PROMPT_ELI5 = `You are explaining stock analysis to a beginner trader. Use simple language, no jargon.
Return markdown: ## What's Happening (plain English), ## The Numbers (table with "what it means" column), ## The Simple Verdict.
Keep it friendly and educational.`;

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': getOrigin(request),
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // ── KV-based Rate Limiting ──
  if (env?.RATE_LIMIT_KV) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const key = `rl:${ip}`;
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxReqs = env?.RATE_LIMIT_PER_MIN || 10;

    const entry = await env.RATE_LIMIT_KV.get(key, { type: 'json' }).catch(() => null);
    let count = 1;
    if (entry && now - entry.reset < windowMs) {
      count = entry.count + 1;
    }
    // Atomically update
    await env.RATE_LIMIT_KV.put(
      key,
      JSON.stringify({ count, reset: now }),
      { expirationTtl: 120 },
    ).catch(() => {});

    if (count > maxReqs) {
      return json({ error: 'Rate limit exceeded. Try again in a minute.' }, 429, request);
    }
  }

  // ── Chat only ──
  if ((path === '/' || path === '/chat') && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400, request);
    }
    const ticker = (body?.ticker || '').trim().toUpperCase();
    if (!ticker || !/^[A-Z]{1,5}(\.[A-Z]{1,4})?$/.test(ticker))
      return json({ error: 'Invalid ticker' }, 400, request);

    const apiKey = env?.OPENROUTER_API_KEY;
    if (!apiKey) return json({ error: 'API key not configured' }, 500, request);

    const model = env?.OPENROUTER_MODEL || 'deepseek/deepseek-v4-pro';
    const baseUrl = env?.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    const isELI5 = body?.eli5 === true;
    const liveData = await fetchLiveData(ticker);

    let ctx = [`Analyze ticker: ${ticker}`];
    if (liveData) {
      ctx.push(
        `Live price: $${liveData.price}`,
        liveData.change != null
          ? `Change: ${liveData.change >= 0 ? '+' : ''}${liveData.change.toFixed(2)}%`
          : '',
      );
      ctx.push(`Volume: ${(liveData.volume / 1e6).toFixed(1)}M`);
    }
    ctx.push(isELI5 ? 'Explain simply.' : 'Provide detailed analysis with tables.');

    try {
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://briefing.arshadkazi.ca',
          'X-Title': 'Morning Briefing Chat',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: isELI5 ? PROMPT_ELI5 : PROMPT_NORMAL,
            },
            { role: 'user', content: ctx.join('\n') },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      });
      if (!resp.ok) return json({ error: `OpenRouter error: ${resp.status}` }, 502, request);

      const result = await resp.json();
      const content = result?.choices?.[0]?.message?.content || 'No analysis.';
      let ctxBlock = '';
      if (liveData) {
        const sign = liveData.change >= 0 ? '+' : '';
        ctxBlock = `<div class=\"live-data-card\">${ticker} $${liveData.price} ${sign}${liveData.change?.toFixed(2)}% Vol: ${(liveData.volume / 1e6).toFixed(1)}M</div>`;
      }
      return json({
        ticker,
        content,
        contextBlock: ctxBlock,
        model: result?.model || model,
        liveData,
      }, 200, request);
    } catch {
      return json({ error: 'Internal error' }, 500, request);
    }
  }

  return json({ error: 'Not found' }, 404, request);
}

export default { fetch: handleRequest };
