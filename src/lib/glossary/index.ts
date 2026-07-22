// lib/glossary/index.ts — single source of truth for plain-English explanations.
//
// Every piece of trader jargon the site shows a user should have exactly one
// entry here. Components never inline their own wording: they either wrap the
// jargon in <InfoTip term="…"> (tooltip, Learning Mode) or read `plainLabel`
// for the always-on subtitle under an opaque header.
//
// Accuracy rules for anyone editing this file:
//   1. `plain` must describe what THIS site actually computes, not the textbook
//      concept. Where the two differ, describe ours and say so.
//   2. Never soften a definition into something that is no longer true. On a
//      finance site a confidently-wrong explanation is worse than raw jargon.
//   3. `plain` is for someone who has never traded an option. No jargon inside
//      the definition of jargon — if a word needs its own entry, use it only
//      when the sentence still works without knowing it.

export interface GlossaryEntry {
  /**
   * Everyday-English name for the concept. Rendered as an always-on subtitle
   * beneath opaque acronym headers, so it must stand alone with no tooltip.
   * Keep it under ~40 characters. Omit when the displayed label is already
   * plain enough that a subtitle would be noise.
   */
  plainLabel?: string;
  /** One or two sentences a first-time investor can follow. Always required. */
  plain: string;
  /**
   * Extra precision for experienced users — the mechanism, the convention, or
   * the caveat. Shown under `plain` in the tooltip, in dimmer text.
   */
  detail?: string;
}

// `satisfies` rather than a type annotation: it still checks every entry against
// GlossaryEntry, but keeps the literal key union so `GlossaryTerm` below is the
// actual list of terms. That turns "term used in a component but never defined"
// — which previously rendered a silently empty tooltip — into a build error.
export const GLOSSARY = {
  /* ---------------------------------------------------------------- */
  /*  Dealer positioning / options structure                          */
  /* ---------------------------------------------------------------- */

  gex: {
    plainLabel: 'How much hedging is in play',
    plain:
      'How much buying and selling the banks that sold these options have to do just to stay balanced as prices move. It sizes how much hedging activity is riding on this market.',
    detail:
      'Gamma exposure. The figure shown here is a GROSS total — calls and puts are added together rather than netted — so it is always positive and cannot by itself tell you whether dealers are damping moves or amplifying them. For that, read Dealer Gamma on the Dealer Positioning card, where puts are counted negative.',
  },
  dex: {
    plainLabel: 'Which way the options lean',
    plain:
      'Whether the outstanding options tilt bullish or bearish overall. Positive means they lean long, negative means they lean short.',
    detail:
      'Delta exposure. Note this does NOT describe how dealers hedge price moves — the buy-dips / sell-rallies behaviour is driven by gamma, not delta.',
  },
  vex: {
    plainLabel: 'How much money rides on volatility',
    plain:
      'How much the value of all these options shifts when the market gets calmer or more panicked — separately from which direction prices go.',
    detail:
      'Vega exposure, aggregated across the entire listed option chain. It is a gross figure (calls and puts both positive), so it sizes how much money is exposed to volatility, not which way anyone leans. It refers to the whole market, not to anything you hold.',
  },
  max_gex_strike: {
    plainLabel: 'Strongest hedging magnet',
    plain:
      'The single price level where dealer hedging is most concentrated. Prices often drift toward it and stall there, because that is where dealers trade hardest to stay balanced.',
    detail:
      'The strike with the largest gamma exposure. This is not max pain — max pain is a different calculation, shown on the Dealer Positioning card.',
  },
  max_pain: {
    plainLabel: 'Where option buyers lose most',
    plain:
      'The price at which the largest dollar value of open options would expire worthless — the level where option buyers as a group lose the most and the sellers pay out the least. The theory is that prices drift toward it as expiry nears.',
    detail:
      'Calculated from open interest weighted by how far each contract would finish in the money — not by counting contracts. A widely-watched heuristic, not a law: treat it as one landmark among several, never a forecast.',
  },
  gamma_wall: {
    plainLabel: 'Price level that acts like a wall',
    plain:
      'The price where the most options are piled up. Dealers hedge hardest there, so moves tend to stall or bounce when they reach it — a call-heavy level above today’s price acts as a ceiling, a put-heavy level below it as a floor.',
    detail:
      'This barrier behaviour only holds while dealers are net long gamma. When they are net short, the same level can accelerate a move through it instead of blocking it.',
  },
  zero_gamma: {
    plainLabel: 'The calm/chaos tipping point',
    plain:
      'The price level where dealer hedging flips from calming the market down to stirring it up. Above it, moves get damped; below it, the same news produces a much bigger swing.',
    detail: 'Also shown as "Gamma Flip". Crossing it is often what turns an orderly pullback into a fast one.',
  },
  gamma_flip: {
    plainLabel: 'The calm/chaos tipping point',
    plain:
      'The price where dealer hedging flips from steadying the market to amplifying it. Above this level moves get damped; below it they get exaggerated.',
    detail: 'Same idea as zero gamma, computed from signed dealer gamma with puts counted negative.',
  },
  dealer_gamma: {
    plainLabel: 'Are dealers cushioning or chasing?',
    plain:
      '"Long" means dealers are absorbing moves, which keeps the market range-bound. "Short" means they are forced to chase moves, which makes trends run further and faster.',
    detail: 'Signed dealer gamma — puts counted negative, the true dealer convention rather than gross GEX.',
  },
  vanna: {
    plainLabel: 'Hedging shift when fear changes',
    plain:
      'How much dealers have to re-hedge when volatility moves, even if the price itself does not. It is why a calm drift up can quietly attract more buying.',
    detail: 'Change in delta exposure per 1% change in implied volatility.',
  },
  charm: {
    plainLabel: 'Hedging drift from time passing',
    plain:
      'How much dealer hedging changes purely because a day has gone by. It is the slow tug you often see into Friday afternoons.',
    detail: 'Delta decay per day — the time-derivative of delta.',
  },
  nope: {
    plainLabel: 'Options tail wagging the stock',
    plain:
      'Compares how much trading the options market is forcing against how many actual shares are changing hands. Large readings suggest options activity — not ordinary buyers and sellers — is steering the price.',
    detail:
      'Net Options Pricing Effect: options-implied delta flow divided by share volume. End-of-day estimate.',
  },
  oi: {
    plainLabel: 'Contracts still open',
    plain:
      'How many option contracts are currently open and not yet closed out. Bigger numbers mean more money is committed at that price level.',
    detail: 'Open interest. On the strike table this is the combined call + put figure for that strike.',
  },
  open_interest: {
    plainLabel: 'Contracts still open',
    plain:
      'How many option contracts are currently open and not yet closed out. Bigger numbers mean more money is riding on that price level.',
  },
  strike: {
    plainLabel: 'The option’s agreed price',
    plain:
      'The price an option lets you buy or sell the stock at. It is not what the option costs — it is the level the contract is written around.',
  },
  call: {
    plainLabel: 'A bet the price rises',
    plain: 'A contract that profits if the stock goes up. It gives the holder the right to buy at the strike price.',
  },
  put: {
    plainLabel: 'A bet the price falls',
    plain:
      'A contract that profits if the stock goes down. It gives the holder the right to sell at the strike price, so it is also used as insurance.',
  },
  iv: {
    plainLabel: 'How big a move is priced in',
    plain:
      'How large a swing the options market expects from here. High readings mean options are expensive because traders expect turbulence.',
    detail: 'Implied volatility — the volatility number that makes an option pricing model match the traded price.',
  },
  delta: {
    plainLabel: 'Move per $1 of stock',
    plain: 'How much an option’s value changes when the stock moves one dollar.',
  },
  gamma: {
    plainLabel: 'How fast that sensitivity shifts',
    plain:
      'How quickly an option’s sensitivity to the stock changes as the price moves. High gamma is what forces dealers to trade repeatedly to stay hedged.',
  },
  theta: {
    plainLabel: 'Daily cost of waiting',
    plain: 'How much value an option loses each day simply because expiry is one day closer.',
  },
  vega: {
    plainLabel: 'Sensitivity to fear levels',
    plain: 'How much an option’s value changes when expected volatility rises or falls.',
  },
  skew: {
    plainLabel: 'Which side traders fear more',
    plain:
      'The price gap between downside protection and upside bets. When downside protection costs much more, the market is paying up to hedge against a fall.',
  },
  contango: {
    plainLabel: 'Normal, calm futures pricing',
    plain:
      'When contracts for later dates cost more than today’s price. For volatility this is the normal, relaxed state; the reverse — backwardation — is a stress signal.',
  },
  backwardation: {
    plainLabel: 'Stress pricing',
    plain:
      'When contracts for later dates cost less than today’s price. In volatility markets this usually means traders expect trouble right now rather than later.',
  },

  /* ---------------------------------------------------------------- */
  /*  Market state                                                    */
  /* ---------------------------------------------------------------- */

  vix: {
    plainLabel: 'The market’s fear gauge',
    plain:
      'An estimate of how big a swing the S&P 500 might make over the next month. Roughly: under 15 is calm, over 25 is frightened.',
    detail:
      'The CBOE Volatility Index. It measures the expected 30-day volatility of the S&P 500 index itself, implied by the prices traders are paying for S&P 500 options.',
  },
  regime: {
    plainLabel: 'The market’s current mood',
    plain:
      'What kind of market we are in right now — calm, choppy, or stressed. It matters because an approach that works in a calm market often fails in a stressed one.',
  },
  gamma_regime: {
    plainLabel: 'Steadying or destabilizing?',
    plain:
      'Whether dealer hedging is currently damping moves or amplifying them. This describes market stability — it is not a prediction that prices will go up or down.',
    detail:
      'Derived from the sign of total gamma exposure. The bullish/bearish wording refers to the hedging backdrop, not to a directional call.',
  },
  breadth: {
    plainLabel: 'How many stocks are joining in',
    plain:
      'Whether a move is broad or narrow. A rally carried by only a handful of giant companies is weaker than one where most stocks are rising.',
  },
  spot: {
    plainLabel: 'Current price',
    plain: 'The price the asset is trading at right now.',
  },
  fomc: {
    plainLabel: 'Fed interest-rate meeting',
    plain:
      'The US Federal Reserve committee that sets interest rates. Its announcement days are among the most market-moving events of the year.',
  },
  sector_rotation: {
    plainLabel: 'Money moving between industries',
    plain:
      'When investors shift money out of one group of industries and into another — for example out of tech and into utilities.',
  },
  catalyst: {
    plainLabel: 'Event that could move the price',
    plain: 'A scheduled or breaking event — earnings, a Fed decision, a product launch — that could move the price sharply.',
  },

  /* ---------------------------------------------------------------- */
  /*  Model quality and statistics                                    */
  /* ---------------------------------------------------------------- */

  conviction: {
    plainLabel: 'Today’s market score',
    plain:
      'A single 0–10 score for how the day is shaping up. Higher leans bullish, lower leans bearish — the up/down call shown beside it is read off this score, so it is a direction score rather than a measure of certainty.',
    detail:
      'Blends four inputs: how favourable the VIX regime is (25%), the strength of today’s scanner signals (30%), the win rate of the last 10 closed paper trades (25%), and market breadth (20%). Stored 0–1 and multiplied by 10 for the gauge.',
  },
  calibration: {
    plainLabel: 'Is the model’s confidence honest?',
    plain:
      'Checks whether the model’s confidence can be trusted: when it says something is 70% likely, does it actually happen about 70% of the time? A well-calibrated model sits close to the diagonal line.',
  },
  backtest: {
    plainLabel: 'Tested on past data',
    plain:
      'Replaying a strategy against historical market data to see how it would have done. These are simulated results, not money anyone actually made.',
  },
  walk_forward: {
    plainLabel: 'Tested on data it never saw',
    plain:
      'A stricter test: the strategy is built using older data, then judged only on newer data it has never seen. This is what catches strategies that merely look good in hindsight.',
  },
  is_sharpe: {
    plainLabel: 'Score on familiar data',
    plain:
      'Risk-adjusted performance measured on the same data the strategy was built from. It flatters the strategy, so treat it as the optimistic number.',
    detail: 'In-sample Sharpe ratio.',
  },
  oos_sharpe: {
    plainLabel: 'Score on fresh data',
    plain:
      'Risk-adjusted performance measured on data the strategy had never seen. This is the number that actually matters.',
    detail: 'Out-of-sample Sharpe ratio.',
  },
  sharpe: {
    plainLabel: 'Return for the risk taken',
    plain:
      'How much return a strategy earns for the amount of turbulence it puts you through. Higher is better; above 1 is usually considered good.',
  },
  degradation: {
    plainLabel: 'How much it fades on new data',
    plain:
      'How much worse the strategy performs on fresh data than on the data it was built from. A large drop means it was tuned to the past rather than to anything real.',
  },
  profit_factor: {
    plainLabel: 'Gains vs losses',
    plain:
      'Total winnings divided by total losses. Above 1 means the strategy made money overall; 2 means it won twice as much as it lost.',
  },
  expectancy: {
    plainLabel: 'Average result per trade',
    plain:
      'The average profit or loss you would expect from a single trade, including the losers. A small positive number repeated many times is what compounds.',
  },
  hit_rate: {
    plainLabel: 'Share of trades that won',
    plain:
      'How often trades ended in profit. On its own it means little — a strategy can win rarely and still do well if the wins are large.',
  },
  win_rate: {
    plainLabel: 'Share of trades that won',
    plain:
      'How often trades ended in profit. A high win rate is not automatically good if the occasional loss is huge.',
  },
  max_drawdown: {
    plainLabel: 'Worst losing stretch',
    plain:
      'The biggest peak-to-bottom fall the strategy ever suffered — the most painful stretch you would have had to sit through without giving up.',
  },
  kelly: {
    plainLabel: 'Suggested stake size',
    plain:
      'A formula for how much to stake given your edge. The figure shown is deliberately half of what the formula suggests, because the full amount is far too aggressive to live with in practice.',
    detail:
      'The Kelly Criterion, displayed as half-Kelly (0.5×). Raw Kelly is also capped at 50% before halving. Fractional Kelly trades away some theoretical growth for a much smoother ride.',
  },
  confidence_interval: {
    plainLabel: 'Likely range',
    plain:
      'The range the model expects the result to fall inside most of the time. A wide range means the model is genuinely unsure.',
  },
  sample_size: {
    plainLabel: 'How much evidence',
    plain:
      'How many trades or observations the number is based on. A great-looking result from a handful of trades is mostly luck.',
  },
  risk_reward: {
    plainLabel: 'Gain vs risk on the trade',
    plain:
      'How much the idea aims to make compared with what it risks. 2:1 means targeting twice the gain of the loss you would take if it fails.',
  },
  slippage: {
    plainLabel: 'Price you wanted vs price you got',
    plain: 'The gap between the price you expected to trade at and the price you actually got.',
  },
  mean_reversion: {
    plainLabel: 'Betting on a snap-back',
    plain: 'A strategy that bets an unusually large move has gone too far and will pull back toward normal.',
  },
  momentum: {
    plainLabel: 'Betting the trend continues',
    plain: 'A strategy that bets a move already under way will keep going in the same direction.',
  },
  cohort: {
    plainLabel: 'A group tracked together',
    plain: 'A group of similar things followed as one set, so their results can be compared fairly.',
  },
  signal_family: {
    plainLabel: 'Type of trade idea',
    plain: 'The category a trade idea belongs to — for example trend-following versus snap-back — grouped by the kind of logic behind it.',
  },

  /* ---------------------------------------------------------------- */
  /*  Trade mechanics                                                 */
  /* ---------------------------------------------------------------- */

  stop: {
    plainLabel: 'Automatic exit if wrong',
    plain: 'A pre-set price where the trade is closed to cap the loss if it moves the wrong way.',
  },
  trailing_stop: {
    plainLabel: 'Exit that follows the gains',
    plain: 'A stop that moves up as the trade goes your way, locking in profit while leaving room to run.',
  },
  target: {
    plainLabel: 'Planned exit if right',
    plain: 'The price the idea aims to reach, where the plan is to take the profit.',
  },
  entry_zone: {
    plainLabel: 'Price range to buy in',
    plain: 'The price range where the idea is considered worth entering. Above it, the risk/reward no longer works.',
  },
  paper_trading: {
    plainLabel: 'Practice trades, no real money',
    plain:
      'Simulated trades using fake money. Every result on this site is paper-traded — no real capital is deployed.',
  },
  position_sizing: {
    plainLabel: 'How much to commit',
    plain: 'Deciding how much money to put into a single trade — usually the most important risk decision you make.',
  },
  atr: {
    plainLabel: 'Typical daily swing',
    plain:
      'The size of a normal day’s price movement for this stock. Useful for setting stops that are not so tight that ordinary noise triggers them.',
    detail: 'Average True Range.',
  },
  rsi: {
    plainLabel: 'Run too hot or too cold?',
    plain:
      'A 0–100 gauge of whether a stock has risen or fallen unusually fast recently. Above 70 is often called overbought, below 30 oversold.',
    detail: 'Relative Strength Index. A stretched reading can persist for a long time in a strong trend.',
  },
  sec_form_4: {
    plainLabel: 'Insider buy/sell filing',
    plain:
      'A form company insiders must file when they buy or sell their own company’s shares. Buying is often read as a vote of confidence.',
  },

  /* ---------------------------------------------------------------- */
  /*  Chart and screener readouts                                     */
  /* ---------------------------------------------------------------- */

  support: {
    plainLabel: 'Price floor buyers defend',
    plain: 'A price level where buyers have repeatedly stepped in before, so falls have tended to stall there.',
  },
  resistance: {
    plainLabel: 'Price ceiling sellers defend',
    plain: 'A price level where sellers have repeatedly stepped in before, so rallies have tended to stall there.',
  },
  key_levels: {
    plainLabel: 'Prices worth watching',
    plain:
      'The handful of prices the market has reacted to before. They are reference points, not predictions — a level only matters until it breaks.',
  },
  sma_20: {
    plainLabel: '20-day average price',
    plain:
      'The average closing price over the last 20 trading days, drawn as a smooth line. Price above it is usually read as short-term strength.',
  },
  sma_50: {
    plainLabel: '50-day average price',
    plain: 'The average closing price over the last 50 trading days. Widely watched as a medium-term trend line.',
  },
  vwap: {
    plainLabel: 'Average price weighted by volume',
    plain:
      'The average price paid so far today, counting heavily-traded prices more. Institutions use it to judge whether they bought well or badly.',
    detail: 'Volume-Weighted Average Price.',
  },
  candles: {
    plainLabel: 'Price bars',
    plain:
      'Each bar shows four things for one time period: where the price opened and closed, and the highest and lowest it reached. Green closed up, red closed down.',
  },
  beta: {
    plainLabel: 'How much it swings vs the market',
    plain:
      'How violently a stock moves compared with the market overall. Above 1 means it typically swings more than the market; below 1 means it is steadier.',
  },
  p_e: {
    plainLabel: 'Price vs profits',
    plain:
      'The share price divided by yearly profit per share — roughly, how many years of today’s profits you are paying for. High can mean expensive, or it can mean fast growth is expected.',
    detail: 'Price-to-Earnings ratio.',
  },
  eps: {
    plainLabel: 'Profit per share',
    plain: 'The company’s profit divided by its number of shares — the per-share slice of what the business earned.',
    detail: 'Earnings Per Share.',
  },
  div_yield: {
    plainLabel: 'Yearly cash paid to holders',
    plain:
      'The annual dividend as a percentage of the share price — the cash return from simply holding, before any price change.',
  },
  market_cap: {
    plainLabel: 'Total value of the company',
    plain: 'What the whole company is worth at today’s share price: price multiplied by the number of shares.',
  },
  ten_year_yield: {
    plainLabel: '10-year US government borrowing rate',
    plain:
      'The interest rate the US government pays to borrow for ten years. It is the benchmark that sets the tone for mortgages, loans, and how expensive shares look.',
  },
  put_call_ratio: {
    plainLabel: 'Downside bets vs upside bets',
    plain:
      'How many "price will fall" contracts are trading for every "price will rise" contract. High readings mean traders are leaning defensive.',
  },
  iv_rank: {
    plainLabel: 'Are options pricey right now?',
    plain:
      'Where today’s expected-move pricing sits against its own past year, from 0 to 100. High means options are expensive by this stock’s own standards.',
  },
  technicals: {
    plainLabel: 'Signals from the price chart',
    plain: 'Readings taken from price and volume history alone, ignoring what the business actually does.',
  },
  fundamentals: {
    plainLabel: 'Signals from the business itself',
    plain: 'Readings taken from the company’s actual finances — profits, debt, growth — rather than from its chart.',
  },
  analyst_ratings: {
    plainLabel: 'What professional analysts advise',
    plain:
      'Buy / hold / sell recommendations published by bank analysts who cover the stock. They are opinions, and they are often slow to change.',
  },
  earnings: {
    plainLabel: 'Quarterly profit report',
    plain:
      'A company’s scheduled report on how much it earned last quarter. Prices often move sharply right after one.',
  },

  /* ---------------------------------------------------------------- */
  /*  Performance readouts                                            */
  /* ---------------------------------------------------------------- */

  pf: {
    plainLabel: 'Gains vs losses',
    plain: 'Total winnings divided by total losses. Above 1 means the strategy made money overall.',
    detail: 'Profit factor — measured on summed percent returns, not on the count of winning versus losing trades.',
  },
  avg_pnl: {
    plainLabel: 'Average result per trade',
    plain:
      'The average gain or loss per trade, shown as a percentage of the amount put in — not a dollar figure.',
  },
  equity: {
    plainLabel: 'Account value over time',
    plain:
      'What the simulated account is worth as trades open and close. A rising line means it is compounding; dips are the losing stretches.',
  },
  drawdown: {
    plainLabel: 'Fall from the last peak',
    plain: 'How far the account has dropped below its best-ever value — the stretch you would have had to sit through.',
  },
  w_l: {
    plainLabel: 'Wins vs losses',
    plain: 'How many trades ended in profit versus how many ended in loss. A count of trades, not an amount of money.',
  },
  oos_trades: {
    plainLabel: 'Trades on unseen data',
    plain:
      'How many trades the test produced on data the strategy had never seen. Small counts here make the result unreliable.',
  },
  live_simulation: {
    plainLabel: 'Practice account running now',
    plain:
      'A simulated account trading in real time with fake money, so results build up honestly rather than being replayed from history.',
  },
  breakout: {
    plainLabel: 'Betting on a break through a level',
    plain: 'A strategy that buys when the price pushes decisively past a level it has struggled with before.',
  },
  fills: {
    plainLabel: 'Trades actually executed',
    plain: 'The individual buys and sells that actually went through, and the price each one got.',
  },
  risk_on: {
    plainLabel: 'Investors feeling brave',
    plain: 'A mood where money flows toward riskier assets like shares, because investors feel confident.',
  },
  risk_off: {
    plainLabel: 'Investors seeking safety',
    plain: 'A mood where money leaves shares for safer places like government bonds or cash.',
  },
  opex: {
    plainLabel: 'Options expiry day',
    plain:
      'The day a large batch of options expires. Trading can get unusually choppy as positions are closed or rolled forward.',
  },
} satisfies Record<string, GlossaryEntry>;

/**
 * The set of terms that actually exist. Components type their `term` prop as
 * this, so a typo or an undefined term fails `npm run typecheck` instead of
 * shipping a tooltip that silently renders nothing.
 */
export type GlossaryTerm = keyof typeof GLOSSARY;

/** Look up an entry. Case- and separator-insensitive: "Max Pain" → max_pain. */
export function lookup(term: string): GlossaryEntry | undefined {
  return (GLOSSARY as Record<string, GlossaryEntry>)[normalizeTerm(term)];
}

export function normalizeTerm(term: string): string {
  return term.toLowerCase().trim().replace(/[\s-]+/g, '_');
}

/** Every term, for the glossary page and for tests that assert full coverage. */
export const GLOSSARY_TERMS = Object.keys(GLOSSARY) as GlossaryTerm[];
