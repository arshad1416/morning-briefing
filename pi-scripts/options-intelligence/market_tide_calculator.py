#!/usr/bin/env python3
"""
market_tide_calculator.py
In-house Python implementation of the Unusual Whales "Market Tide" Sentiment Gauge.
Replicates the institutional aggregation logic using low-cost or free local options trade tape feeds.

Rules of the Market Tide:
1. Calls transacted at the Ask (buyer-initiated) INCREASE the net call premium (+).
2. Calls transacted at the Bid (seller-initiated) DECREASE the net call premium (-).
3. Puts transacted at the Ask (buyer-initiated) INCREASE the net put premium (+).
4. Puts transacted at the Bid (seller-initiated) DECREASE the net put premium (-).
5. Transactions taking place at the Mid-price are dropped/ignored.
6. Absolute contribution of any single transaction to the net premium is capped at $2,000,000.
7. Net Volume is defined as:
   (call_volume_ask - call_volume_bid) - (put_volume_ask - put_volume_bid)

This script is built for MapleGamma offline internal benchmarking to comply with Unusual Whales ToS.
"""

import os
import sys
import json
import urllib.request
import urllib.parse
from datetime import datetime, timedelta

class MarketTideCalculator:
    def __init__(self):
        """
        Initializes the rolling state for the Market Tide Sentiment Gauge.
        """
        self.reset()

    def reset(self):
        """
        Resets all cumulative metrics to zero (e.g., at the start of a trading day).
        """
        self.net_call_premium = 0.0
        self.net_put_premium = 0.0

        self.call_volume_ask = 0
        self.call_volume_bid = 0
        self.put_volume_ask = 0
        self.put_volume_bid = 0

        self.call_premium_ask = 0.0
        self.call_premium_bid = 0.0
        self.put_premium_ask = 0.0
        self.put_premium_bid = 0.0

        self.trades_processed = 0
        self.trades_ignored = 0

    def process_trade(self, option_type, price, quantity, bid=None, ask=None, side=None, multiplier=100.0):
        """
        Processes a single option transaction and updates the rolling metrics.

        Parameters:
        - option_type (str): 'call' or 'put' (case-insensitive)
        - price (float): Execution price of the option contract (per share premium, e.g. 2.50)
        - quantity (int): Number of contracts traded
        - bid (float, optional): Bid price at execution time
        - ask (float, optional): Ask price at execution time
        - side (str, optional): Pre-classified side ('ask', 'bid', 'mid', 'above_ask', 'below_bid')
        - multiplier (float, optional): Contract multiplier (default 100.0 for standard equity options)

        Returns:
        - dict: Delta impact of this trade on the metrics
        """
        option_type = option_type.lower()
        if option_type not in ('call', 'put'):
            raise ValueError("option_type must be 'call' or 'put'")

        # 1. Determine trade side (Ask side, Bid side, or Mid/Unknown)
        determined_side = 'mid'

        if side is not None:
            side = side.lower()
            if side in ('ask', 'above_ask'):
                determined_side = 'ask'
            elif side in ('bid', 'below_bid'):
                determined_side = 'bid'
            elif side == 'mid':
                determined_side = 'mid'
        elif bid is not None and ask is not None:
            bid = float(bid)
            ask = float(ask)
            if bid == ask:
                # If spread is zero, check execution price
                if price > bid:
                    determined_side = 'ask'
                elif price < bid:
                    determined_side = 'bid'
                else:
                    determined_side = 'mid'
            else:
                midpoint = (bid + ask) / 2.0
                if price > midpoint:
                    determined_side = 'ask'
                elif price < midpoint:
                    determined_side = 'bid'
                else:
                    determined_side = 'mid'
        else:
            # Lacking classification info; default to mid/ignored
            determined_side = 'mid'

        if determined_side == 'mid':
            self.trades_ignored += 1
            return {
                'side_used': 'mid',
                'premium_impact': 0.0,
                'volume_impact': 0
            }

        # 2. Calculate Premium and Apply the $2,000,000 Cap
        raw_premium = float(price) * int(quantity) * float(multiplier)
        capped_premium = min(raw_premium, 2000000.0)

        # 3. Update State Accumulators
        premium_impact = 0.0
        volume_impact = 0

        if option_type == 'call':
            if determined_side == 'ask':
                self.net_call_premium += capped_premium
                self.call_premium_ask += capped_premium
                self.call_volume_ask += int(quantity)
                premium_impact = capped_premium
                volume_impact = int(quantity)
            elif determined_side == 'bid':
                self.net_call_premium -= capped_premium
                self.call_premium_bid += capped_premium
                self.call_volume_bid += int(quantity)
                premium_impact = -capped_premium
                volume_impact = -int(quantity)
        elif option_type == 'put':
            if determined_side == 'ask':
                self.net_put_premium += capped_premium
                self.put_premium_ask += capped_premium
                self.put_volume_ask += int(quantity)
                premium_impact = capped_premium
                volume_impact = -int(quantity) # Put buying is bearish, reduces net volume
            elif determined_side == 'bid':
                self.net_put_premium -= capped_premium
                self.put_premium_bid += capped_premium
                self.put_volume_bid += int(quantity)
                premium_impact = -capped_premium
                volume_impact = int(quantity) # Put selling is bullish, increases net volume

        self.trades_processed += 1

        return {
            'side_used': determined_side,
            'premium_impact': premium_impact,
            'volume_impact': volume_impact
        }

    def process_trades(self, trades):
        """
        Batch processes a list of raw options trade records.
        Each trade should be a dict with key fields.
        """
        results = []
        for trade in trades:
            res = self.process_trade(
                option_type=trade.get('option_type'),
                price=trade.get('price'),
                quantity=trade.get('quantity'),
                bid=trade.get('bid'),
                ask=trade.get('ask'),
                side=trade.get('side'),
                multiplier=trade.get('multiplier', 100.0)
            )
            results.append(res)
        return results

    @property
    def net_volume(self):
        """
        Calculates rolling Net Option Volume:
        (call_volume_ask - call_volume_bid) - (put_volume_ask - put_volume_bid)
        """
        net_call_vol = self.call_volume_ask - self.call_volume_bid
        net_put_vol = self.put_volume_ask - self.put_volume_bid
        return net_call_vol - net_put_vol

    @property
    def sentiment_metrics(self):
        """
        Exposes analytical sentiment metrics computed from the current rolling state.
        """
        total_premium_abs = abs(self.net_call_premium) + abs(self.net_put_premium)

        # Bounded between -100 (Extremely Bearish) and +100 (Extremely Bullish)
        if total_premium_abs > 0:
            sentiment_score = 100.0 * (self.net_call_premium - self.net_put_premium) / total_premium_abs
        else:
            sentiment_score = 0.0

        return {
            'net_call_premium': self.net_call_premium,
            'net_put_premium': self.net_put_premium,
            'net_volume': self.net_volume,
            'net_premium_difference': self.net_call_premium - self.net_put_premium,
            'sentiment_score': sentiment_score,
            'interpretation': (
                'Strong Bullish' if sentiment_score >= 50 else
                'Moderate Bullish' if sentiment_score >= 15 else
                'Strong Bearish' if sentiment_score <= -50 else
                'Moderate Bearish' if sentiment_score <= -15 else
                'Neutral'
            ),
            'meta': {
                'trades_processed': self.trades_processed,
                'trades_ignored': self.trades_ignored,
                'call_volume_ask': self.call_volume_ask,
                'call_volume_bid': self.call_volume_bid,
                'put_volume_ask': self.put_volume_ask,
                'put_volume_bid': self.put_volume_bid
            }
        }

    def fetch_unusual_whales_tide(self, date=None, interval_5m=False, otm_only=False):
        """
        Queries the Unusual Whales Market Tide API to fetch official benchmark data.

        Parameters:
        - date (str, optional): Format 'YYYY-MM-DD'. Defaults to current market day.
        - interval_5m (bool): Return 5-minute interval bars instead of 1-minute.
        - otm_only (bool): Filters calculation to Out-of-the-Money contracts only.

        Returns:
        - dict: Official API payload including 'data' time-series.
        """
        key = os.environ.get('UNUSUAL_WHALES_API_KEY')
        if not key:
            raise ValueError("UNUSUAL_WHALES_API_KEY environment variable is not set.")

        headers = {
            'Authorization': f'Bearer {key}',
            'UW-CLIENT-API-ID': '100001',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
        }

        params = {}
        if date:
            params['date'] = date
        if interval_5m:
            params['interval_5m'] = 'true'
        if otm_only:
            params['otm_only'] = 'true'

        query_str = urllib.parse.urlencode(params)
        url = 'https://api.unusualwhales.com/api/market/market-tide'
        if query_str:
            url += f'?{query_str}'

        req = urllib.request.Request(url, headers=headers)

        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                res = json.loads(r.read().decode())
                return res
        except Exception as e:
            raise RuntimeError(f"Failed to fetch Market Tide from Unusual Whales: {e}")

    def bin_raw_trades_to_intervals(self, raw_trades, interval_minutes=1):
        """
        Takes a sequence of tick-by-tick option trades with timestamps,
        applies the exact cumulative Market Tide aggregation, and groups them
        into binned intervals (1-minute or 5-minute), matching the format of Unusual Whales.

        Parameters:
        - raw_trades (list of dicts): Must include 'timestamp' (ISO string or datetime),
          'option_type', 'price', 'quantity', 'bid', 'ask', 'side'.
        - interval_minutes (int): Binning resolution, e.g., 1 or 5.

        Returns:
        - list of dicts: Binned Market Tide time-series.
        """
        if not raw_trades:
            return []

        # Parse timestamps and sort chronologically
        parsed_trades = []
        for t in raw_trades:
            ts = t['timestamp']
            if isinstance(ts, str):
                # Handle ISO format timezone offsets safely (e.g., -04:00)
                if ts.endswith('Z'):
                    ts_dt = datetime.fromisoformat(ts[:-1].split('.')[0])
                elif '-' in ts[-6:] or '+' in ts[-6:]:
                    # timezone suffix exists
                    ts_dt = datetime.fromisoformat(ts)
                else:
                    ts_dt = datetime.fromisoformat(ts)
            else:
                ts_dt = ts
            parsed_trades.append((ts_dt, t))

        parsed_trades.sort(key=lambda x: x[0])

        start_time = parsed_trades[0][0]
        # Align to the start of the minute
        start_time = start_time.replace(second=0, microsecond=0)

        binned_data = []

        # Reset state for cumulative calculation
        self.reset()

        current_interval_start = start_time
        interval_delta = timedelta(minutes=interval_minutes)
        current_interval_end = current_interval_start + interval_delta

        trades_in_interval = []

        trade_idx = 0
        total_trades = len(parsed_trades)

        while trade_idx < total_trades or trades_in_interval:
            # Gather all trades belonging to the current interval window
            while trade_idx < total_trades and parsed_trades[trade_idx][0] < current_interval_end:
                trades_in_interval.append(parsed_trades[trade_idx][1])
                trade_idx += 1

            # Process gathered trades for the current bin
            for trade in trades_in_interval:
                self.process_trade(
                    option_type=trade.get('option_type'),
                    price=trade.get('price'),
                    quantity=trade.get('quantity'),
                    bid=trade.get('bid'),
                    ask=trade.get('ask'),
                    side=trade.get('side'),
                    multiplier=trade.get('multiplier', 100.0)
                )

            # Save cumulative snapshot at the end of this interval
            binned_data.append({
                'timestamp': current_interval_start.isoformat(),
                'date': current_interval_start.strftime('%Y-%m-%d'),
                'net_call_premium': f"{self.net_call_premium:.4f}",
                'net_put_premium': f"{self.net_put_premium:.4f}",
                'net_volume': self.net_volume,
                'sentiment_score': round(self.sentiment_metrics['sentiment_score'], 2)
            })

            # Move to next interval
            trades_in_interval = []
            if trade_idx >= total_trades:
                break

            current_interval_start = current_interval_end
            current_interval_end = current_interval_start + interval_delta

        return binned_data


if __name__ == "__main__":
    print("MarketTideCalculator loaded successfully.")
