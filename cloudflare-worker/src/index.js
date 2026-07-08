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

// COMPLIANCE: this service must stay within the non-tailored-advice exemption.
// Both prompts forbid personalized advice; NON_TAILORED_RULES must remain in
// every system prompt, and the disclaimer footer is appended to every response.
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
async function positionDisclosure(ticker) {
  try {
    const res = await fetch('https://briefing.arshadkazi.ca/data/ibkr_positions.json', {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return '';
    const data = await res.json();
    const held = (data?.positions || []).some(
      (p) => String(p.ticker || p.symbol || '').toUpperCase().trim() === ticker,
    );
    return held
      ? `\n\n📌 **Position disclosure:** the site operator currently holds a position in ${ticker} (Interactive Brokers).`
      : '';
  } catch {
    return '';
  }
}

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

  // Rate limiting uses Cloudflare dashboard rules (WAF).
  // See Cloudflare dashboard → Security → Rate Limiting for configuration.
  // Recommended: 10 requests per 60 seconds per IP on /chat endpoint.

  // -- Feedback (site feedback bubble) --
  // Additive route; forwards to Telegram. Optional durable inbox if a KV
  // namespace named FEEDBACK is bound (no-op when unbound).
  if (path === "/feedback" && request.method === "POST") {
    let fb;
    try { fb = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400, request); }
    const type = ["feature", "bug", "general"].includes(fb?.type) ? fb.type : "general";
    const message = String(fb?.message || "").trim().slice(0, 2000);
    const email = fb?.email ? String(fb.email).trim().slice(0, 200) : "";
    const page = String(fb?.page || "").slice(0, 80);
    if (message.length < 3) return json({ error: "message_too_short" }, 400, request);
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "bad_email" }, 400, request);

    const token = env?.TELEGRAM_BOT_TOKEN;
    const chatId = env?.TELEGRAM_HOME_CHANNEL;
    if (!token || !chatId) return json({ error: "sink_unconfigured" }, 500, request);

    const icon = type === "bug" ? "\u{1F41E}" : type === "feature" ? "✨" : "\u{1F4AC}";
    const ip = request.headers.get("CF-Connecting-IP") || "?";
    const text = `${icon} MapleGamma feedback (${type})\n\n${message}\n\n— page: ${page || "#/"}\n— email: ${email || "(none)"}\n— ip: ${ip}`;

    try {
      if (env?.FEEDBACK) {
        await env.FEEDBACK.put(`fb:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          JSON.stringify({ type, message, email, page, ip, ts: Date.now() }));
      }
    } catch (e) {}

    try {
      const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
      if (!tg.ok) return json({ error: "delivery_failed" }, 502, request);
    } catch (e) {
      return json({ error: "delivery_failed" }, 502, request);
    }
    return json({ ok: true }, 200, request);
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
      let content = result?.choices?.[0]?.message?.content || 'No analysis.';
      content += await positionDisclosure(ticker);
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

  return json({ error: 'Not found' }, 404, request);
}

export default { fetch: handleRequest };
