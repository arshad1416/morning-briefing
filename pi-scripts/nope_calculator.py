#!/usr/bin/env python3
"""
nope_calculator.py
Net Options Pricing Emission (NOPE) Local Calculator & Calibration Engine.
Provides high-accuracy, $0/mo replication of the Unusual Whales NOPE indicator
by sourcing free, publicly accessible yfinance option chain and stock feeds.
"""

import os
import sys
import math
import time
import json
import urllib.request
from datetime import datetime, timezone
import numpy as np
import pandas as pd
import yfinance as yf

class NopeCalculator:
    """
    Local calculator for Net Options Pricing Emission (NOPE).
    Replicates institutional Unusual Whales NOPE metrics using free yfinance feeds,
    calibrating Black-Scholes delta models against actual API baselines.
    """
    
    def __init__(self, r=0.045, default_iv=0.20, k_call=0.9115, k_put=1.3943,
                 call_fill_ratio=0.9639, put_fill_ratio=1.2921, session=None):
        """
        Initialize the calculator.
        
        Parameters:
            r (float): Risk-free interest rate (default: 4.5%).
            default_iv (float): Fallback implied volatility (default: 20%).
            k_call (float): Calibration coefficient for call option deltas (default: 0.9115).
            k_put (float): Calibration coefficient for put option deltas (default: 1.3943).
            call_fill_ratio (float): Historical ratio of fill delta to raw delta for calls (default: 0.9639).
            put_fill_ratio (float): Historical ratio of fill delta to raw delta for puts (default: 1.2921).
        """
        self.r = r
        self.default_iv = default_iv
        self.k_call = k_call
        self.k_put = k_put
        self.call_fill_ratio = call_fill_ratio
        self.put_fill_ratio = put_fill_ratio
        self.session = session if session is not None else self.create_yfinance_session()

    @staticmethod
    def _new_curl_session():
        """Create yfinance's supported browser-impersonating HTTP session."""
        from curl_cffi import requests as curl_requests
        return curl_requests.Session(impersonate="chrome")

    @classmethod
    def create_yfinance_session(cls):
        """Prefer curl_cffi; allow yfinance's built-in fallback if unavailable."""
        try:
            return cls._new_curl_session()
        except (ImportError, ModuleNotFoundError):
            return None

    @staticmethod
    def calibration_quality(local, uw, min_ratio=0.8, max_ratio=1.25):
        """Reject calibration when the vendors are not observing comparable tape."""
        def ratio(name):
            reference = float(uw.get(name) or 0)
            return float(local.get(name) or 0) / reference if reference else 0.0

        ratios = {
            "stock_volume_ratio": ratio("stock_vol"),
            "call_volume_ratio": ratio("call_vol"),
            "put_volume_ratio": ratio("put_vol"),
        }
        ratios["usable"] = all(min_ratio <= value <= max_ratio for value in ratios.values())
        return ratios

    def calibrate_snapshot(self, snapshot, uw_tip):
        """Fit weights and score the same snapshot, avoiding a second data fetch."""
        raw_call_delta = float(snapshot["call_delta_raw"])
        raw_put_delta = float(snapshot["put_delta_raw"])
        uw_call_delta = float(uw_tip["call_delta"])
        uw_put_delta = float(uw_tip["put_delta"])

        self.k_call = uw_call_delta / raw_call_delta if raw_call_delta else 1.0
        self.k_put = uw_put_delta / raw_put_delta if raw_put_delta else 1.0
        self.call_fill_ratio = float(uw_tip["call_fill_delta"]) / uw_call_delta if uw_call_delta else 1.0
        self.put_fill_ratio = float(uw_tip["put_fill_delta"]) / uw_put_delta if uw_put_delta else 1.0

        stock_vol = float(snapshot["stock_vol"])
        call_delta_est = raw_call_delta * self.k_call
        put_delta_est = raw_put_delta * self.k_put
        call_fill_delta_est = call_delta_est * self.call_fill_ratio
        put_fill_delta_est = put_delta_est * self.put_fill_ratio
        return {
            "call_delta_est": call_delta_est,
            "put_delta_est": put_delta_est,
            "nope_est": (call_delta_est + put_delta_est) / stock_vol,
            "call_fill_delta_est": call_fill_delta_est,
            "put_fill_delta_est": put_fill_delta_est,
            "nope_fill_est": (call_fill_delta_est + put_fill_delta_est) / stock_vol,
        }
        
    @staticmethod
    def norm_cdf(x):
        """Standard Normal Cumulative Distribution Function."""
        return 0.5 * (1 + math.erf(x / math.sqrt(2)))
        
    def bs_delta(self, S, K, T, option_type, iv=None):
        """
        Calculate analytical Black-Scholes Delta.
        
        Parameters:
            S (float): Spot price.
            K (float): Strike price.
            T (float): Time to maturity in years.
            option_type (str): 'call' or 'put'.
            iv (float, optional): Implied Volatility. Uses default_iv if None/invalid.
        """
        if T <= 0:
            T = 1.0 / 365.0  # Avoid division by zero, treat as 1-day expiry
            
        sigma = iv if (iv is not None and pd.notna(iv) and iv > 0.01) else self.default_iv
        
        try:
            d1 = (math.log(S / K) + (self.r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
            if option_type == 'call':
                return self.norm_cdf(d1)
            else:
                return self.norm_cdf(d1) - 1
        except Exception:
            return 0.5 if option_type == 'call' else -0.5

    def get_spot_and_volume(self, ticker):
        """
        Retrieves current spot price and daily cumulative volume of the underlying ticker.
        Combines history queries and metadata/fast_info for robust fallback behaviors.
        """
        # Try history first
        try:
            hist = ticker.history(period="1d")
            if not hist.empty:
                spot = hist["Close"].iloc[-1]
                vol = hist["Volume"].iloc[-1]
                if pd.notna(spot) and pd.notna(vol) and vol > 0:
                    return float(spot), int(vol)
        except Exception:
            pass
            
        # Try fast_info metadata
        try:
            fast = ticker.fast_info
            spot = fast.get('lastPrice') or fast.get('previousClose')
            # `lastVolume` may be the size of the most recent print. NOPE needs
            # cumulative underlying volume, so prefer the daily `volume` field.
            vol = fast.get('volume') or fast.get('lastVolume')
            if spot is not None and vol is not None and vol > 0:
                return float(spot), int(vol)
        except Exception:
            pass
            
        raise ValueError("Could not fetch valid spot price and volume from yfinance.")

    def calculate_snapshot(self, symbol="SPY"):
        """
        Fetch options chains from yfinance and compute the NOPE and NOPE_Fill snapshots.
        
        Returns:
            dict: Comprehensive snapshot data.
        """
        ticker = yf.Ticker(symbol, session=self.session)
        S, stock_vol = self.get_spot_and_volume(ticker)
        
        expiries = ticker.options
        if not expiries:
            raise ValueError(f"No option expiries found for ticker {symbol}.")
            
        now = datetime.now()
        
        total_call_delta_raw = 0.0
        total_put_delta_raw = 0.0
        total_call_vol = 0
        total_put_vol = 0
        
        for expiry in expiries:
            try:
                expiry_dt = datetime.strptime(expiry, "%Y-%m-%d")
                T = (expiry_dt - now).days / 365.0
                if T <= 0:
                    T = 1.0 / 365.0  # Minimum 1 day maturity for today's expiries
                    
                chain = ticker.option_chain(expiry)
                
                # Process Call Chain
                if 'volume' in chain.calls.columns:
                    calls = chain.calls[chain.calls['volume'] > 0]
                    for _, row in calls.iterrows():
                        vol = int(row['volume'])
                        K = float(row['strike'])
                        iv = row['impliedVolatility'] if pd.notna(row['impliedVolatility']) else self.default_iv
                        delta = self.bs_delta(S, K, T, 'call', iv)
                        total_call_delta_raw += delta * vol * 100
                        total_call_vol += vol
                        
                # Process Put Chain
                if 'volume' in chain.puts.columns:
                    puts = chain.puts[chain.puts['volume'] > 0]
                    for _, row in puts.iterrows():
                        vol = int(row['volume'])
                        K = float(row['strike'])
                        iv = row['impliedVolatility'] if pd.notna(row['impliedVolatility']) else self.default_iv
                        delta = self.bs_delta(S, K, T, 'put', iv)
                        total_put_delta_raw += delta * vol * 100
                        total_put_vol += vol
                        
            except Exception:
                # Silently skip failed/missing expiry downloads
                pass
                
        # Raw mathematical NOPE metrics (uncalibrated)
        nope_raw = (total_call_delta_raw + total_put_delta_raw) / stock_vol if stock_vol > 0 else 0.0
        
        # Calibrated/Estimated delta exposures
        call_delta_est = total_call_delta_raw * self.k_call
        put_delta_est = total_put_delta_raw * self.k_put
        nope_est = (call_delta_est + put_delta_est) / stock_vol if stock_vol > 0 else 0.0
        
        # Signed Order Flow / Fill Delta metrics
        call_fill_delta_est = call_delta_est * self.call_fill_ratio
        put_fill_delta_est = put_delta_est * self.put_fill_ratio
        nope_fill_est = (call_fill_delta_est + put_fill_delta_est) / stock_vol if stock_vol > 0 else 0.0
        
        return {
            'timestamp': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'spot_price': S,
            'stock_vol': stock_vol,
            'call_vol': total_call_vol,
            'put_vol': total_put_vol,
            'call_delta_raw': total_call_delta_raw,
            'put_delta_raw': total_put_delta_raw,
            'nope_raw': nope_raw,
            'call_delta_est': call_delta_est,
            'put_delta_est': put_delta_est,
            'nope_est': nope_est,
            'call_fill_delta_est': call_fill_delta_est,
            'put_fill_delta_est': put_fill_delta_est,
            'nope_fill_est': nope_fill_est
        }
        
    def fetch_unusual_whales_nope(self, symbol="SPY"):
        """
        Fetch the current official NOPE series from Unusual Whales API.
        Requires UNUSUAL_WHALES_API_KEY environment variable.
        """
        key = os.environ.get('UNUSUAL_WHALES_API_KEY')
        if not key:
            raise ValueError("UNUSUAL_WHALES_API_KEY not found in environment.")
            
        headers = {
            'Authorization': f'Bearer {key}',
            'UW-CLIENT-API-ID': '100001',
            'User-Agent': 'Mozilla/5.0'
        }
        
        url = f'https://api.unusualwhales.com/api/stock/{symbol}/nope'
        req = urllib.request.Request(url, headers=headers)
        
        last_error = None
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=15) as r:
                    res = json.loads(r.read().decode())
                    return res.get('data', [])
            except Exception as e:
                last_error = e
                if attempt < 2:
                    time.sleep(2 ** attempt)
        raise RuntimeError(f"Failed to fetch from Unusual Whales: {last_error}")
            
    def run_calibration(self, symbol="SPY", verbose=True):
        """
        Query concurrent API baselines and run an automatic regression 
        to fine-tune our multiplier parameters (k_call, k_put).
        """
        if verbose:
            print(f"Beginning automatic NOPE calibration for {symbol}...")
            
        # 1. Fetch current Unusual Whales data tip
        uw_list = self.fetch_unusual_whales_nope(symbol)
        if not uw_list:
            raise ValueError("No comparison data received from Unusual Whales.")
        uw_tip = uw_list[0] # Newest data point
        
        # 2. Fetch yfinance option snapshot concurrently
        yf_snap = self.calculate_snapshot(symbol)
        quality = self.calibration_quality(yf_snap, uw_tip)
        
        if verbose:
            print("\nConcurrently Fetched Datasets:")
            print(f"  Underlying Stock Volume (UW): {uw_tip['stock_vol']} | (yfinance): {yf_snap['stock_vol']}")
            print(f"  Call Volume            (UW): {uw_tip['call_vol']} | (yfinance): {yf_snap['call_vol']}")
            print(f"  Put Volume             (UW): {uw_tip['put_vol']} | (yfinance): {yf_snap['put_vol']}")
            
        if not quality["usable"]:
            raise ValueError(
                "Calibration feeds are not aligned: "
                f"stock={quality['stock_volume_ratio']:.3f}, "
                f"calls={quality['call_volume_ratio']:.3f}, "
                f"puts={quality['put_volume_ratio']:.3f}. "
                "Retry during overlapping market-data windows."
            )

        calibrated = self.calibrate_snapshot(yf_snap, uw_tip)
        
        if verbose:
            print("\nUpdating Calibration Multipliers:")
            print(f"  k_call         : {self.k_call:.6f}")
            print(f"  k_put          : {self.k_put:.6f}")
            print(f"  call_fill_ratio: {self.call_fill_ratio:.6f}")
            print(f"  put_fill_ratio : {self.put_fill_ratio:.6f}")
            print(f"  UW NOPE        : {uw_tip['nope']} | Calibrated Local NOPE: {calibrated['nope_est']:.6f}")
            
        return {
            'k_call': self.k_call,
            'k_put': self.k_put,
            'call_fill_ratio': self.call_fill_ratio,
            'put_fill_ratio': self.put_fill_ratio
        }

    def save_snapshot(self, data, filepath="nope_history.csv"):
        """
        Save calculated snapshot data to a local file.
        Supports appending to existing CSV/JSON format history.
        """
        df = pd.DataFrame([data])
        
        # Handle file paths gracefully
        if filepath.endswith('.csv'):
            if os.path.exists(filepath):
                df.to_csv(filepath, mode='a', header=False, index=False)
            else:
                df.to_csv(filepath, index=False)
        elif filepath.endswith('.json'):
            history = []
            if os.path.exists(filepath):
                try:
                    with open(filepath, 'r') as f:
                        history = json.load(f)
                except Exception:
                    pass
            history.append(data)
            with open(filepath, 'w') as f:
                json.dump(history, f, indent=2)

def fetch_tiingo_underlying(ticker, api_key):
    import urllib.request
    import json
    from datetime import datetime, timedelta, timezone
    start_date = (datetime.now(timezone.utc) - timedelta(days=5)).strftime("%Y-%m-%d")
    url = f"https://api.tiingo.com/tiingo/daily/{ticker}/prices?startDate={start_date}"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Token {api_key}"
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            data = json.loads(response.read().decode("utf-8"))
            if data and isinstance(data, list):
                latest = data[-1]
                return {
                    "close": float(latest["close"]),
                    "volume": int(latest["volume"]),
                    "date": latest["date"][:10]  # YYYY-MM-DD
                }
    except Exception as e:
        print(f"Error fetching Tiingo underlying data for {ticker}: {e}")
    return None


def write_nope_detail(snapshots, destination, generated_at=None):
    """Write the Pro product artifact without calibration or raw-delta internals."""
    payload = {
        "generated_at": generated_at or datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        "methodology": "Calculated estimate from option-chain volume and Black-Scholes delta. Data coverage may be delayed or incomplete intraday; not real-time order flow or investment advice.",
        "symbols": {},
    }
    fields = {
        "spot_price": "spot_price",
        "stock_vol": "stock_volume",
        "call_vol": "call_volume",
        "put_vol": "put_volume",
        "nope_est": "nope",
        "nope_fill_est": "nope_fill",
    }
    for symbol, snapshot in snapshots.items():
        payload["symbols"][symbol] = {output: snapshot.get(source) for source, output in fields.items()}

    destination = os.fspath(destination)
    os.makedirs(os.path.dirname(destination) or ".", exist_ok=True)
    temporary = f"{destination}.tmp"
    with open(temporary, "w") as file:
        json.dump(payload, file, indent=2)
    os.replace(temporary, destination)
    return destination


def calculate_and_publish_nope(symbols=("SPY", "QQQ"), output_path=None):
    """Publish the website artifact without coupling the release to optional history feeds."""
    calculator = NopeCalculator()
    snapshots = {}
    for symbol in symbols:
        try:
            snapshots[symbol] = calculator.calculate_snapshot(symbol)
        except Exception as error:
            print(f"Error calculating NOPE for {symbol}: {error}", file=sys.stderr)
    if not snapshots:
        raise RuntimeError("No NOPE snapshots were generated; refusing to publish an empty artifact.")
    detail_path = output_path or os.path.join(os.getcwd(), "data", "nope-detail.json")
    detail_path = write_nope_detail(snapshots, detail_path)
    print(f"Published NOPE product artifact: {detail_path}")
    return detail_path


def calculate_and_log_daily_nope(symbols=["SPY", "QQQ"], output_path=None):
    print("Starting daily NOPE ingestion...")
    # Get Tiingo key
    import sys
    import os
    # Load env
    sys.path.append(os.path.expanduser("~/.hermes/scripts"))
    try:
        from ingest_tiingo_data import get_tiingo_api_key
        api_key = get_tiingo_api_key()
    except ImportError:
        api_key = os.getenv("TIINGO_API_KEY")

    if not api_key:
        print("ERROR: TIINGO_API_KEY not found!")
        return

    try:
        from turso_helper import turso_execute_many
    except ImportError:
        print("ERROR: turso_helper.py not found!")
        return

    # Init table
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS market_indicators (
        ticker TEXT,
        date TEXT,
        spot_price REAL,
        stock_vol INTEGER,
        call_vol INTEGER,
        put_vol INTEGER,
        nope_raw REAL,
        nope_est REAL,
        nope_fill_est REAL,
        created_at TEXT,
        PRIMARY KEY (ticker, date)
    )
    """
    res = turso_execute_many([create_table_sql])
    if "error" in res:
        print(f"Error creating Turso market_indicators table: {res['error']}")
        return

    calculator = NopeCalculator()
    sqls = []
    snapshots = {}
    created_at = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

    for symbol in symbols:
        try:
            print(f"Processing {symbol}...")
            # Fetch options chain snapshot from yfinance
            snap = calculator.calculate_snapshot(symbol)
            snapshots[symbol] = snap
            
            # Fetch exact closing spot price and stock volume from Tiingo
            tiingo_data = fetch_tiingo_underlying(symbol, api_key)
            if not tiingo_data:
                print(f"Skipping {symbol} because Tiingo underlying fetch failed.")
                continue

            spot_price = tiingo_data["close"]
            stock_vol = tiingo_data["volume"]
            date_val = tiingo_data["date"]

            # Re-calculate NOPE with Tiingo spot and volume
            call_delta_raw = snap["call_delta_raw"]
            put_delta_raw = snap["put_delta_raw"]

            nope_raw = (call_delta_raw + put_delta_raw) / stock_vol if stock_vol > 0 else 0.0
            nope_est = (call_delta_raw * calculator.k_call + put_delta_raw * calculator.k_put) / stock_vol if stock_vol > 0 else 0.0
            nope_fill_est = (call_delta_raw * calculator.k_call * calculator.call_fill_ratio + put_delta_raw * calculator.k_put * calculator.put_fill_ratio) / stock_vol if stock_vol > 0 else 0.0

            sql = f"""
            INSERT OR REPLACE INTO market_indicators (ticker, date, spot_price, stock_vol, call_vol, put_vol, nope_raw, nope_est, nope_fill_est, created_at)
            VALUES ('{symbol}', '{date_val}', {spot_price}, {stock_vol}, {snap['call_vol']}, {snap['put_vol']}, {nope_raw:.6f}, {nope_est:.6f}, {nope_fill_est:.6f}, '{created_at}')
            """
            sqls.append(sql)
            print(f"✅ Prepared NOPE record for {symbol} on {date_val}: raw={nope_raw:.6f}, est={nope_est:.6f}")
        except Exception as e:
            print(f"Error processing {symbol}: {e}")

    if sqls:
        print(f"Uploading {len(sqls)} daily NOPE records to Turso...")
        res = turso_execute_many(sqls)
        if "error" in res:
            print(f"Error uploading daily NOPE records to Turso: {res['error']}")
        else:
            print("Successfully uploaded daily NOPE indicators to Turso!")
    if snapshots:
        detail_path = output_path or os.path.join(
            os.getcwd(), "data", "nope-detail.json"
        )
        write_nope_detail(snapshots, detail_path)
        print(f"Published NOPE product artifact: {detail_path}")
    else:
        raise RuntimeError("No NOPE snapshots were generated; refusing to publish an empty artifact.")

if __name__ == "__main__":
    if "--daily" in sys.argv or "--publish" in sys.argv:
        output_path = None
        if "--output" in sys.argv:
            output_index = sys.argv.index("--output") + 1
            if output_index >= len(sys.argv):
                raise ValueError("--output requires a path")
            output_path = sys.argv[output_index]
        if "--daily" in sys.argv:
            calculate_and_log_daily_nope(["SPY", "QQQ"], output_path=output_path)
        else:
            calculate_and_publish_nope(["SPY", "QQQ"], output_path=output_path)
    else:
        # If run directly, run a quick SPY snapshot and calibration
        calculator = NopeCalculator()
        try:
            snap = calculator.calculate_snapshot("SPY")
            print("="*60)
            print("          NOPE LOCAL CALCULATOR SNAPSHOT (SPY)")
            print("="*60)
            print(f"Timestamp   : {snap['timestamp']}")
            print(f"Spot Price  : ${snap['spot_price']:.2f}")
            print(f"Stock Vol   : {snap['stock_vol']:,}")
            print(f"Call Vol    : {snap['call_vol']:,}")
            print(f"Put Vol     : {snap['put_vol']:,}")
            print("-"*60)
            print(f"Raw NOPE        : {snap['nope_raw']:.6f}")
            print(f"Calibrated NOPE : {snap['nope_est']:.6f}")
            print(f"Estimated Fill  : {snap['nope_fill_est']:.6f}")
            print("="*60)
            
            # Check if Unusual Whales credentials exist, if so run a calibration test
            if os.environ.get('UNUSUAL_WHALES_API_KEY'):
                print("\nUNUSUAL_WHALES_API_KEY detected. Running calibration regression...")
                calib = calculator.run_calibration("SPY")
                print("Calibration complete.")
        except Exception as e:
            print(f"Error running snapshot/calibration: {e}")
