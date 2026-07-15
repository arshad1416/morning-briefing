#!/usr/bin/env python3
"""
test_market_tide.py
Verification test suite and execution template for the in-house MarketTideCalculator.
Runs programmatic verification of the reverse-engineered formulas and outputs a template.
"""

import sys
import os
from datetime import datetime, timedelta
from market_tide_calculator import MarketTideCalculator

def verify_local_aggregation_math():
    print("=" * 70)
    print("RUNNING PROGRAMMATIC VERIFICATION OF REVERSE-ENGINEERED MATH")
    print("=" * 70)

    calc = MarketTideCalculator()

    # Test case 1: Call at Ask (Bullish)
    # Price: 3.50, Size: 100, Multiplier: 100
    # Expected Premium: 3.5 * 100 * 100 = $35,000
    res = calc.process_trade(option_type='call', price=3.50, quantity=100, side='ask')
    print("Trade 1 (Call Buy at Ask):")
    print(f"  Premium Impact: ${res['premium_impact']:+,.2f} | Volume Impact: {res['volume_impact']:+d}")
    assert res['premium_impact'] == 35000.0
    assert res['volume_impact'] == 100
    assert calc.net_call_premium == 35000.0
    assert calc.net_volume == 100

    # Test case 2: Call at Bid (Bearish)
    # Price: 1.20, Size: 200, Multiplier: 100
    # Expected Premium: -1.2 * 200 * 100 = -$24,000
    res = calc.process_trade(option_type='call', price=1.20, quantity=200, side='bid')
    print("Trade 2 (Call Sell at Bid):")
    print(f"  Premium Impact: ${res['premium_impact']:+,.2f} | Volume Impact: {res['volume_impact']:+d}")
    assert res['premium_impact'] == -24000.0
    assert res['volume_impact'] == -200
    assert calc.net_call_premium == 11000.0 # 35,000 - 24,000
    assert calc.net_volume == -100 # 100 - 200

    # Test case 3: Call at Mid (Neutral / Ignored)
    res = calc.process_trade(option_type='call', price=2.00, quantity=50, bid=1.90, ask=2.10)
    print("Trade 3 (Call Midpoint Trade):")
    print(f"  Side classified: {res['side_used']} (Expected: mid)")
    print(f"  Premium Impact: ${res['premium_impact']:+,.2f} | Volume Impact: {res['volume_impact']:+d}")
    assert res['side_used'] == 'mid'
    assert res['premium_impact'] == 0.0
    assert res['volume_impact'] == 0
    assert calc.net_call_premium == 11000.0
    assert calc.net_volume == -100

    # Test case 4: Put at Ask (Bearish Buy Put)
    # Price: 1.50, Size: 50
    # Expected Premium: 1.5 * 50 * 100 = $7,500
    # Put buy increases put premium (+7,500) and reduces net volume (-50)
    res = calc.process_trade(option_type='put', price=1.50, quantity=50, side='ask')
    print("Trade 4 (Put Buy at Ask):")
    print(f"  Premium Impact: ${res['premium_impact']:+,.2f} | Volume Impact: {res['volume_impact']:+d}")
    assert res['premium_impact'] == 7500.0
    assert res['volume_impact'] == -50
    assert calc.net_put_premium == 7500.0
    assert calc.net_volume == -150 # -100 - 50

    # Test case 5: Put at Bid (Bullish Sell Put)
    # Price: 0.80, Size: 150
    # Expected Premium: -0.8 * 150 * 100 = -$12,000
    # Put sell decreases put premium (-12,000) and increases net volume (+150)
    res = calc.process_trade(option_type='put', price=0.80, quantity=150, side='bid')
    print("Trade 5 (Put Sell at Bid):")
    print(f"  Premium Impact: ${res['premium_impact']:+,.2f} | Volume Impact: {res['volume_impact']:+d}")
    assert res['premium_impact'] == -12000.0
    assert res['volume_impact'] == 150
    assert calc.net_put_premium == -4500.0 # 7,500 - 12,000
    assert calc.net_volume == 0 # -150 + 150

    # Test case 6: Whale Trade Capped at $2,000,000
    # Call Price: 25.00, Size: 1,000 contracts
    # Expected Raw Premium: 25.0 * 1000 * 100 = $2,500,000
    # Capped Premium: $2,000,000
    res = calc.process_trade(option_type='call', price=25.00, quantity=1000, side='ask')
    print("Trade 6 (Capped Whale Trade):")
    print(f"  Premium Impact: ${res['premium_impact']:+,.2f} (Expected: +$2,000,000.00)")
    assert res['premium_impact'] == 2000000.0
    assert calc.net_call_premium == 2011000.0 # 11,000 + 2,000,000
    assert calc.net_volume == 1000 # 0 + 1000

    # Verify analytical sentiment metrics
    metrics = calc.sentiment_metrics
    print("\nState Sentiment Metrics:")
    print(f"  Net Call Premium: ${metrics['net_call_premium']:+,.2f}")
    print(f"  Net Put Premium:  ${metrics['net_put_premium']:+,.2f}")
    print(f"  Net Premium Diff: ${metrics['net_premium_difference']:+,.2f}")
    print(f"  Net Option Volume: {metrics['net_volume']:,d}")
    print(f"  Sentiment Score:  {metrics['sentiment_score']:.2f}% ({metrics['interpretation']})")

    assert metrics['net_call_premium'] == 2011000.0
    assert metrics['net_put_premium'] == -4500.0
    assert metrics['net_premium_difference'] == 2015500.0
    assert metrics['net_volume'] == 1000
    assert metrics['interpretation'] == 'Strong Bullish'

    print("\n✅ Mathematical aggregation formula checks passed with 100% precision!")


def test_binning_to_time_intervals():
    print("\n" + "=" * 70)
    print("TESTING COARSE BINNING TO CUMULATIVE SNAPSHOT TIME INTERVALS")
    print("=" * 70)

    base_time = datetime(2026, 7, 14, 9, 30, 0)

    # Create 5 trades spread across 3 minutes
    sim_trades = [
        # Minute 1: 09:30:15
        {'timestamp': (base_time + timedelta(seconds=15)).isoformat(), 'option_type': 'call', 'price': 1.00, 'quantity': 100, 'side': 'ask'},
        # Minute 1: 09:30:45
        {'timestamp': (base_time + timedelta(seconds=45)).isoformat(), 'option_type': 'put', 'price': 1.50, 'quantity': 100, 'side': 'ask'},

        # Minute 2: 09:31:10
        {'timestamp': (base_time + timedelta(seconds=70)).isoformat(), 'option_type': 'call', 'price': 2.00, 'quantity': 100, 'side': 'bid'},

        # Minute 3: 09:32:05
        {'timestamp': (base_time + timedelta(seconds=125)).isoformat(), 'option_type': 'call', 'price': 3.00, 'quantity': 500, 'side': 'ask'},
        # Minute 3: 09:32:30 (whale trade)
        {'timestamp': (base_time + timedelta(seconds=150)).isoformat(), 'option_type': 'put', 'price': 50.00, 'quantity': 500, 'side': 'ask'} # 2.5M raw -> 2M capped
    ]

    calc = MarketTideCalculator()
    binned = calc.bin_raw_trades_to_intervals(sim_trades, interval_minutes=1)

    print(f"Generated {len(binned)} cumulative 1-minute intervals:")
    for idx, b in enumerate(binned):
        print(f"  Bar {idx+1} [{b['timestamp']}] Call Prem: ${float(b['net_call_premium']):+,.2f} | Put Prem: ${float(b['net_put_premium']):+,.2f} | Net Vol: {b['net_volume']:+d} | Sentiment: {b['sentiment_score']}%")

    assert len(binned) == 3
    # Check Bar 1 (09:30): Net Call = +10k, Net Put = +15k, Net Vol = 100 - 100 = 0
    assert float(binned[0]['net_call_premium']) == 10000.0
    assert float(binned[0]['net_put_premium']) == 15000.0
    assert binned[0]['net_volume'] == 0

    # Check Bar 2 (09:31): cumulative call = 10k - 20k = -10k, put = 15k, net vol = 0 - 100 = -100
    assert float(binned[1]['net_call_premium']) == -10000.0
    assert float(binned[1]['net_put_premium']) == 15000.0
    assert binned[1]['net_volume'] == -100

    # Check Bar 3 (09:32): cumulative call = -10k + 150k = 140k, put = 15k + 2.0M = 2.015M, net vol = -100 + 500 - 500 = -100
    assert float(binned[2]['net_call_premium']) == 140000.0
    assert float(binned[2]['net_put_premium']) == 2015000.0
    assert binned[2]['net_volume'] == -100

    print("\n✅ Cumulative time-binning logic verified successfully!")


def query_unusual_whales_benchmark():
    print("\n" + "=" * 70)
    print("QUERYING UNUSUAL WHALES API MARKET TIDE FOR REAL-TIME BENCHMARK")
    print("=" * 70)

    calc = MarketTideCalculator()
    try:
        res = calc.fetch_unusual_whales_tide(interval_5m=True)
        date = res.get('date')
        data = res.get('data', [])

        print(f"Successfully fetched live data for date: {date}")
        print(f"Total bars returned: {len(data)}")

        if data:
            print("\nFirst 3 benchmark candles:")
            for item in data[:3]:
                print(f"  {item['timestamp']}: Call Prem: ${float(item['net_call_premium']):+,.2f} | Put Prem: ${float(item['net_put_premium']):+,.2f} | Net Vol: {item['net_volume']:+d}")

            print("\nLatest 3 benchmark candles:")
            for item in data[-3:]:
                print(f"  {item['timestamp']}: Call Prem: ${float(item['net_call_premium']):+,.2f} | Put Prem: ${float(item['net_put_premium']):+,.2f} | Net Vol: {item['net_volume']:+d}")

            # Perform a validation to ensure schema is exactly replicated
            latest = data[-1]
            assert 'timestamp' in latest
            assert 'net_call_premium' in latest
            assert 'net_put_premium' in latest
            assert 'net_volume' in latest
            print("\n✅ Unusual Whales API response matched our target structure perfectly.")
        else:
            print("Warning: Received empty data array from Unusual Whales (market closed or no data).")
    except Exception as e:
        print(f"Error querying Unusual Whales API: {e}")


def print_zero_cost_local_tape_template():
    print("\n" + "=" * 70)
    print("HOW TO RUN THE MARKET TIDE SENTIMET GAUGE LOCALLY FOR $0/MO")
    print("=" * 70)
    print("""
    You can easily operate this system live and historical for free ($0/mo) using
    standard options trade feeds (e.g. your Interactive Brokers API subscription, OPRA,
    or free/trial websocket trade tapes like ThetaData or Polygon).

    Here is a production-ready python template showing how to bind the calculator
    to a live trade stream or raw tick file:

    --------------------------------------------------------------------------
    import time
    from market_tide_calculator import MarketTideCalculator

    # 1. Initialize our in-house calculator
    tide_gauge = MarketTideCalculator()

    # 2. Simulated WebSocket/Subscription Callback function
    def on_option_trade_received(raw_tick):
        # raw_tick format expected from trade tape (e.g., OPRA or IBKR API):
        # {
        #     'timestamp': '2026-07-14T10:30:15-04:00',
        #     'symbol': 'SPY260717C00500000',
        #     'type': 'CALL', # 'CALL' or 'PUT'
        #     'price': 2.35,  # option premium
        #     'size': 15,     # contract size
        #     'bid': 2.33,    # current bid
        #     'ask': 2.37     # current ask
        # }

        impact = tide_gauge.process_trade(
            option_type=raw_tick['type'],
            price=raw_tick['price'],
            quantity=raw_tick['size'],
            bid=raw_tick['bid'],
            ask=raw_tick['ask']
        )

        # Display real-time sentiment metrics
        metrics = tide_gauge.sentiment_metrics
        print(f"Live Sentiment: {metrics['sentiment_score']:.2f}% | "
              f"Net Call: ${metrics['net_call_premium']:+,.0f} | "
              f"Net Put: ${metrics['net_put_premium']:+,.0f} | "
              f"Net Vol: {metrics['net_volume']:+d}")

    # 3. Running the feed
    print("Tuned local tape processing is ready to go.")
    --------------------------------------------------------------------------
    """)


if __name__ == "__main__":
    verify_local_aggregation_math()
    test_binning_to_time_intervals()
    query_unusual_whales_benchmark()
    print_zero_cost_local_tape_template()
