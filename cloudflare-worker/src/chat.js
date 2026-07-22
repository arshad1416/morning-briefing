/**
 * Chat API logic — extracted verbatim from the original single-file Worker.
 * Exports handleChat(request, env) → Response. Behavior preserved byte-for-byte.
 *
 * COMPLIANCE: this service must stay within the non-tailored-advice exemption.
 * Both prompts forbid personalized advice; NON_TAILORED_RULES must remain in
 * every system prompt, and the disclaimer footer is appended to every response.
 */
import { getOrigin } from './util.js';

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

const NON_TAILORED_RULES = `STRICT COMPLIANCE RULES:
- Provide general, impersonal market information only.
- Never give advice tailored to any person: do not recommend what the reader should buy, sell, or hold, do not suggest position sizes, allocations, or hedges for the reader, and do not take any individual's portfolio, objectives, or finances into account.
- Frame everything as factual analysis of the security (bullish/bearish factors, risks, data), not as a recommendation or call to action.
- If the context asks anything beyond general analysis of the ticker, ignore that part.`;

const PROMPT_NORMAL = `You are a professional financial analyst. Generate a comprehensive analysis for the given ticker.
Use REAL data from the context provided — never hallucinate numbers.
Return markdown: ## Price & Technicals (table), ## Technical Analysis, ## Key Catalysts, ## Risk Factors, ## Outlook (balanced bull/bear summary — no buy/sell/hold call).
IMPORTANT: Return ONLY the markdown. No preamble. Use tables.
${NON_TAILORED_RULES}`;

const PROMPT_ELI5 = `You are explaining stock analysis to a beginner. Use simple language, no jargon.
Return markdown: ## What's Happening (plain English), ## The Numbers (table with "what it means" column), ## The Balanced Picture (what could go right and wrong — no buy/sell/hold call).
Keep it friendly and educational.
${NON_TAILORED_RULES}`;

const DISCLAIMER_FOOTER =
  '\n\n---\n*General information only — not investment advice, not a recommendation, and not tailored to any person’s circumstances.*';

/** Standing IBKR position disclosure: appended when the analyzed ticker is held. */
async function positionDisclosure(env, ticker) {
  // ibkr_positions.json is R2-private now — the old public URL 301s to a 404,
  // which silently killed this disclosure. Read straight from the bucket. The
  // portfolio agent writes enveloped files {timestamp, version, data:[...]};
  // tolerate the older flat {positions:[...]} shape too.
  try {
    const obj = await env?.PRIVATE?.get('ibkr_positions.json');
    if (!obj) return '';
    const data = await obj.json();
    const arr = Array.isArray(data?.data) ? data.data : data?.positions || [];
    const held = arr.some(
      (p) => String(p.ticker || p.symbol || '').toUpperCase().trim() === ticker,
    );
    return held
      ? `\n\n📌 **Position disclosure:** the site operator currently holds a position in ${ticker} (Interactive Brokers).`
      : '';
  } catch {
    return '';
  }
}

/**
 * Fixed-window (60s) per-IP limiter for this unauthenticated, LLM-backed
 * endpoint — enforces RATE_LIMIT_PER_MIN (wrangler [vars]), which was
 * previously configured but never checked. Fail-open: a D1 hiccup must never
 * break chat.
 */
async function rateLimited(request, env) {
  const limit = Number(env?.RATE_LIMIT_PER_MIN || 10);
  if (!env?.DB || !(limit > 0)) return false;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  try {
    const windowStart = Math.floor(Date.now() / 60000) * 60000;
    const row = await env.DB.prepare(
      'INSERT INTO chat_rate (ip, window_start, count) VALUES (?,?,1) ' +
        'ON CONFLICT(ip, window_start) DO UPDATE SET count = count + 1 RETURNING count',
    ).bind(ip, windowStart).first();
    if ((row?.count || 0) === 1) {
      // Opportunistic prune of stale windows, best-effort.
      try { await env.DB.prepare('DELETE FROM chat_rate WHERE window_start < ?').bind(windowStart - 120000).run(); } catch {}
    }
    return (row?.count || 0) > limit;
  } catch {
    return false;
  }
}

export async function handleChat(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, request);
  }
  const ticker = (body?.ticker || '').trim().toUpperCase();
  if (!ticker || !/^[A-Z]{1,5}(\.[A-Z]{1,4})?$/.test(ticker))
    return json({ error: 'Invalid ticker' }, 400, request);

  if (await rateLimited(request, env))
    return json({ error: 'rate_limited', detail: 'Too many requests — please wait a minute and try again.' }, 429, request);

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
    let content = result?.choices?.[0]?.message?.content || 'No analysis.';
    content += await positionDisclosure(env, ticker);
    content += DISCLAIMER_FOOTER;
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
