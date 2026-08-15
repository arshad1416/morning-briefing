// lib/json.ts — JSON.parse for payloads written by Python.
//
// Lives here rather than beside its first caller (lib/backtests/coverage.ts)
// because the archive readers need it too, and one of them —
// app/archive/archive-client.tsx — is a client component that cannot import a
// module which reads node:fs.

/**
 * Bare `Infinity` / `-Infinity` / `NaN` in a numeric slot. Python's json module
 * emits these by default and they are NOT valid JSON, so `JSON.parse` throws.
 *
 * This is not hypothetical: 4 of the 11 committed backtest runs carry
 * `"profit_factor": Infinity` (a run with no losing trades has nothing to
 * divide by), and a plain parse silently dropped every one of them — the page
 * reported "7 saved runs" as though that were the whole corpus. 5 of the 76
 * archived briefings carry `"price": NaN` the same way, from before
 * `atomic_write_json` started passing `allow_nan=False`. The lookarounds keep
 * the match in value position so the word inside a string is untouched.
 */
const NON_FINITE = /(?<=[:[,]\s*)(-?Infinity|NaN)(?=\s*[,\]}])/g;

export function parseTolerantJson(text: string): unknown {
  return JSON.parse(text.replace(NON_FINITE, (token) => `"__nonfinite__${token}"`), (_key, value) => {
    if (typeof value === 'string' && value.startsWith('__nonfinite__')) {
      const token = value.slice('__nonfinite__'.length);
      return token === 'NaN' ? NaN : token === '-Infinity' ? -Infinity : Infinity;
    }
    return value;
  });
}
