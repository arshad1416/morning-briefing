/**
 * Cloudflare Worker — Chat API proxy to OpenRouter.
 * 
 * POST /chat { ticker: "AAPL" }
 * → Calls OpenRouter with a financial analyst system prompt
 * → Returns { ticker, content (markdown), model }
 * 
 * Keeps OPENROUTER_API_KEY server-side.
 * Enforces rate limiting and CORS.
 */

// Simple in-memory rate limiter (per IP)
const rateLimitStore = {};

function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60_000; // 1 minute
  const maxRequests = parseInt(envConfig.RATE_LIMIT_PER_MIN || '10', 10);

  if (!rateLimitStore[ip]) {
    rateLimitStore[ip] = [];
  }

  // Filter out expired entries
  rateLimitStore[ip] = rateLimitStore[ip].filter(ts => now - ts < windowMs);

  if (rateLimitStore[ip].length >= maxRequests) {
    return false;
  }

  rateLimitStore[ip].push(now);
  return true;
}

// Environment config from wrangler.toml or secrets
const envConfig = {
  OPENROUTER_API_KEY: undefined,  // Set via wrangler secret
  OPENROUTER_BASE_URL: undefined, // Set via vars
  OPENROUTER_MODEL: undefined,    // Set via vars
  RATE_LIMIT_PER_MIN: '10',
  ALLOWED_ORIGIN: '*',
};

const SYSTEM_PROMPT = `You are a professional financial analyst. Generate a comprehensive analysis for the given ticker symbol.

Return your analysis in markdown format. Include:

1. **Company Overview** — brief sector, market cap, what they do
2. **Price & Technicals** — Current price, RSI, support/resistance levels, trend direction
3. **Fundamentals** — P/E ratio, EPS, revenue growth, margin quality (if known)
4. **Key Catalysts** — recent events, earnings dates, sector trends
5. **Risk Factors** — what could go wrong
6. **Verdict** — Bullish / Bearish / Neutral with reasoning

Use real data tables for metrics. Be specific with numbers. Use ## for section headers.
Keep the analysis to 3-5 paragraphs with 1-2 tables max.
If you don't know a specific number, provide a reasonable estimate based on the sector average and note it.

IMPORTANT: Return ONLY the analysis markdown. No preamble, no "Here's your analysis" — just the markdown content.`;

function corsHeaders(origin) {
  const allowedOrigin = envConfig.ALLOWED_ORIGIN === '*' ? '*' : envConfig.ALLOWED_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

function errorResponse(status, message, headers) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

async function handleRequest(request, env) {
  const headers = corsHeaders(env?.ALLOWED_ORIGIN);
  const origin = request.headers.get('Origin') || '';

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  // Only POST
  if (request.method !== 'POST') {
    return errorResponse(405, 'Method not allowed', headers);
  }

  // Rate limit by IP
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  if (!checkRateLimit(ip)) {
    return errorResponse(429, 'Rate limit exceeded (10 requests/min). Please wait.', headers);
  }

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, 'Invalid JSON body', headers);
  }

  const ticker = (body?.ticker || '').trim().toUpperCase();
  if (!ticker || !/^[A-Z]{1,5}$/.test(ticker)) {
    return errorResponse(400, 'Invalid ticker. Must be 1-5 uppercase letters (e.g., AAPL).', headers);
  }

  // Read secrets/config
  const apiKey = env?.OPENROUTER_API_KEY || envConfig.OPENROUTER_API_KEY;
  if (!apiKey) {
    return errorResponse(500, 'OpenRouter API key not configured', headers);
  }

  const baseUrl = env?.OPENROUTER_BASE_URL || envConfig.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  const model = env?.OPENROUTER_MODEL || envConfig.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

  // Call OpenRouter
  const userPrompt = `Provide a detailed financial analysis of ${ticker} (${body.ticker || ticker}). Include price (real if you know it, estimated if not), technical indicators, key levels, and a verdict with reasoning.`;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://briefing.yourdomain.com',
        'X-Title': 'Morning Briefing Chat',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenRouter error:', response.status, errText);
      return errorResponse(502, `OpenRouter API error: ${response.status}`, headers);
    }

    const result = await response.json();
    const content = result?.choices?.[0]?.message?.content || 'No analysis generated.';

    return new Response(JSON.stringify({
      ticker,
      content,
      model: result?.model || model,
      usage: result?.usage || null,
    }), { status: 200, headers });
  } catch (err) {
    console.error('Worker error:', err);
    return errorResponse(500, 'Internal server error', headers);
  }
}

// Cloudflare Worker entry point
export default {
  fetch(request, env, ctx) {
    return handleRequest(request, env);
  },
};
