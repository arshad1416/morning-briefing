// lib/ticker/href.ts — pick a working URL for a ticker.
//
// /ticker/[symbol]/ is a static export with `dynamicParams = false`, so it only
// answers for symbols in getTickerCoverage() — the JSON files in data/tickers/.
// Linking to anything outside that set is a HARD 404.
//
// The screener and the coverage set are populated by DIFFERENT Pi jobs
// (generate-screener-data.py vs publish_ticker_details.py) and are not the same
// size. They happened to line up at ~675 vs 681 while the scan covered one
// universe; adding the S&P 400, S&P 600 and Nasdaq-100 takes the screener past
// 1,700 rows, and every row without a detail file becomes a dead link straight
// out of a visible table. So the choice has to be made per symbol, from the
// coverage set the build actually produced, not assumed.
//
// /ticker/?symbol=X renders the same view from the non-static route, so a
// missing detail page degrades to "no data available for X" instead of a 404.

export function hrefForSymbol(symbol: string, covered: ReadonlySet<string>): string {
  const upper = symbol.toUpperCase();
  return covered.has(upper)
    ? `/ticker/${encodeURIComponent(upper)}/`
    : `/ticker/?symbol=${encodeURIComponent(upper)}`;
}
