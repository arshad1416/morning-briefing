import fs from 'node:fs';
import path from 'node:path';

export type TickerCoverage = {
  symbol: string;
  name: string;
  sector?: string;
  generatedAt?: string;
};

const SAFE_SYMBOL = /^[A-Z0-9][A-Z0-9.-]{0,14}$/;

/** Active public ticker artifacts available in the static export. */
export function getTickerCoverage(): TickerCoverage[] {
  const directory = path.join(process.cwd(), 'data', 'tickers');
  try {
    return fs
      .readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .flatMap((entry) => {
        try {
          const payload = JSON.parse(fs.readFileSync(path.join(directory, entry.name), 'utf8'));
          const symbol = String(payload.ticker || entry.name.slice(0, -5)).toUpperCase();
          if (!SAFE_SYMBOL.test(symbol) || !Number.isFinite(Number(payload.price)) || Number(payload.price) <= 0)
            return [];
          return [{
            symbol,
            name: String(payload.name || symbol),
            sector: payload.sector ? String(payload.sector) : undefined,
            generatedAt: payload.generated_at ? String(payload.generated_at) : undefined,
          }];
        } catch {
          return [];
        }
      })
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  } catch {
    return [];
  }
}
