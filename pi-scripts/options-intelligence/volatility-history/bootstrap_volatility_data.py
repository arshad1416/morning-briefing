#!/usr/bin/env python3
"""
bootstrap_volatility_data.py
Robust bulk downloader and bootstrapping script to fetch 90-day historical
implied volatility skew and term structure data for our top 15 tickers.
Saves data as raw JSON files and inserts them into a local SQLite seed database.
"""

import os
import sys
import json
import sqlite3
import asyncio
import logging
import traceback
from pathlib import Path
from datetime import datetime
import aiohttp

# Define Tickers
TICKERS = [
    "SPY", "QQQ", "IWM", "NVDA", "TSLA",
    "AAPL", "MSFT", "AMD", "AMZN", "NFLX",
    "COIN", "MARA", "MSTR", "META", "GOOGL"
]

# API Configuration
BASE_URL = "https://api.unusualwhales.com"
UW_API_KEY = os.environ.get("UNUSUAL_WHALES_API_KEY")
CLIENT_ID = "100001"

# Concurrency & Semaphore Config
MAX_CONCURRENT_REQUESTS = 15
MAX_RETRIES = 3
RETRY_BACKOFF = 1.0  # seconds

# Logging Setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("volatility_bootstrapper")

# Directory Setup
BASE_DIR = Path(__file__).resolve().parent
RAW_JSON_DIR = BASE_DIR / "raw_json"
DB_PATH = BASE_DIR / "volatility_seed.db"


def init_database():
    """Initializes the SQLite database schema and indexes."""
    logger.info(f"Initializing SQLite database at {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Create term_structure table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS term_structure (
            ticker TEXT,
            date TEXT,
            expiry TEXT,
            dte INTEGER,
            volatility REAL,
            implied_move REAL,
            implied_move_perc REAL,
            PRIMARY KEY (ticker, date, expiry)
        )
    """)

    # Create skew table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS skew (
            ticker TEXT,
            date TEXT,
            expiry TEXT,
            delta INTEGER,
            risk_reversal REAL,
            PRIMARY KEY (ticker, date, expiry, delta)
        )
    """)

    # Create indexes for optimization
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_term_structure_ticker_date ON term_structure(ticker, date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_skew_ticker_date ON skew(ticker, date)")

    conn.commit()
    conn.close()
    logger.info("Database initialization complete.")


def get_headers():
    """Builds the headers needed for Unusual Whales API."""
    if not UW_API_KEY:
        logger.error("UNUSUAL_WHALES_API_KEY environment variable is not set!")
        sys.exit(1)
    return {
        "Authorization": f"Bearer {UW_API_KEY}",
        "UW-CLIENT-API-ID": CLIENT_ID,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }


async def fetch_with_retry(session, url, params=None, headers=None, label=""):
    """Fetches a URL with a retry mechanism and exponential backoff."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            async with session.get(url, params=params, headers=headers, timeout=30) as response:
                if response.status == 200:
                    return await response.json()
                elif response.status == 429:
                    wait_time = attempt * RETRY_BACKOFF * 2
                    logger.warning(f"Rate limited (429) on {label}. Retrying in {wait_time:.1f}s (attempt {attempt}/{MAX_RETRIES})...")
                    await asyncio.sleep(wait_time)
                elif response.status == 404:
                    logger.warning(f"Not found (404) for {label}. Skipping.")
                    return None
                else:
                    text = await response.text()
                    logger.error(f"HTTP {response.status} for {label}: {text[:150]}")
                    if attempt < MAX_RETRIES:
                        await asyncio.sleep(attempt * RETRY_BACKOFF)
        except Exception as e:
            logger.error(f"Error fetching {label} (attempt {attempt}/{MAX_RETRIES}): {e}")
            if attempt < MAX_RETRIES:
                await asyncio.sleep(attempt * RETRY_BACKOFF)
    logger.error(f"Failed to fetch {label} after {MAX_RETRIES} attempts.")
    return None


async def save_raw_json(ticker, category, filename, data):
    """Saves raw json data to the archive folder."""
    ticker_dir = RAW_JSON_DIR / ticker / category
    ticker_dir.mkdir(parents=True, exist_ok=True)
    filepath = ticker_dir / f"{filename}.json"
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def insert_term_structure_to_db(ticker, date, records):
    """Inserts a list of term structure records into the database."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    inserted = 0
    for r in records:
        try:
            # Clean and parse fields
            expiry = r.get("expiry")
            dte = r.get("dte")
            vol = r.get("volatility")
            im = r.get("implied_move")
            im_perc = r.get("implied_move_perc")

            # Parse strings to floats if necessary
            vol = float(vol) if vol is not None else None
            im = float(im) if im is not None else None
            im_perc = float(im_perc) if im_perc is not None else None
            dte = int(dte) if dte is not None else None

            cursor.execute("""
                INSERT OR REPLACE INTO term_structure (ticker, date, expiry, dte, volatility, implied_move, implied_move_perc)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (ticker, date, expiry, dte, vol, im, im_perc))
            inserted += 1
        except Exception as e:
            logger.debug(f"Error inserting term structure record: {e}")
    conn.commit()
    conn.close()
    return inserted


def insert_skew_to_db(records):
    """Inserts a list of historical skew records into the database."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    inserted = 0
    for r in records:
        try:
            ticker = r.get("ticker")
            date = r.get("date")
            expiry = r.get("expiry") # Note: skew endpoint may return skew records. Let us verify if expiry is in returned record or if we must add it.
            # Wait, in the actual returned data from curl, we had:
            # {"date":"2025-11-20","ticker":"AAPL","delta":25,"risk_reversal":"0.003702689371418988"}
            # Notice there is no "expiry" in the record returned!
            # But the query is specifically for an expiry.
            # So we must pass down the queried expiry to this function so we can store it!
            # Let us inspect the actual response fields in the downloader.
            pass
        except Exception as e:
            logger.debug(f"Error inserting skew record: {e}")
    conn.commit()
    conn.close()
    return inserted


def insert_skew_record(ticker, date, expiry, delta, risk_reversal):
    """Inserts a single skew record into the database."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    inserted = 0
    try:
        rr = float(risk_reversal) if risk_reversal is not None else None
        cursor.execute("""
            INSERT OR REPLACE INTO skew (ticker, date, expiry, delta, risk_reversal)
            VALUES (?, ?, ?, ?, ?)
        """, (ticker, date, expiry, int(delta), rr))
        inserted = 1
    except Exception as e:
        logger.debug(f"Error inserting single skew record: {e}")
    conn.commit()
    conn.close()
    return inserted


def calculate_and_log_iv_metrics():
    logger.info("Calculating and logging IV Rank and IV Term Structure to Turso...")
    import sqlite3
    sys.path.append(os.path.expanduser("~/.hermes/scripts"))
    try:
        from turso_helper import turso_execute_many
    except ImportError:
        logger.error("turso_helper.py not found or could not import turso_execute_many!")
        return

    # Connect to local volatility_seed.db
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Step 1: Create Turso tables if they don't exist
    create_tables_sql = [
        """
        CREATE TABLE IF NOT EXISTS market_iv_rank (
            ticker TEXT,
            date TEXT,
            iv_rank REAL,
            current_iv REAL,
            min_iv REAL,
            max_iv REAL,
            created_at TEXT,
            PRIMARY KEY (ticker, date)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS market_iv_term_structure (
            ticker TEXT,
            date TEXT,
            expiry TEXT,
            dte INTEGER,
            volatility REAL,
            implied_move_perc REAL,
            created_at TEXT,
            PRIMARY KEY (ticker, date, expiry)
        )
        """
    ]
    # We will execute these on Turso
    res = turso_execute_many(create_tables_sql)
    if "error" in res:
        logger.error(f"Failed to create Turso volatility tables: {res['error']}")
        conn.close()
        return

    # Let's get all tickers and dates in the database
    cursor.execute("SELECT DISTINCT ticker FROM term_structure")
    tickers = [row[0] for row in cursor.fetchall()]

    cursor.execute("SELECT DISTINCT date FROM term_structure ORDER BY date ASC")
    dates = [row[0] for row in cursor.fetchall()]

    if not tickers or not dates:
        logger.warning("No data found in local term_structure database to calculate IV Rank.")
        conn.close()
        return

    logger.info(f"Processing IV Rank and term structure for {len(tickers)} tickers across {len(dates)} dates...")

    # For each ticker and date, calculate the 30-day interpolated volatility
    # Store: {ticker: {date: 30_day_iv}}
    iv_30_dict = {t: {} for t in tickers}

    for ticker in tickers:
        cursor.execute("""
            SELECT date, expiry, dte, volatility
            FROM term_structure
            WHERE ticker = ? AND volatility IS NOT NULL AND dte IS NOT NULL
            ORDER BY date ASC, dte ASC
        """, (ticker,))

        # Group by date
        from collections import defaultdict
        by_date = defaultdict(list)
        for row in cursor.fetchall():
            by_date[row[0]].append({"expiry": row[1], "dte": row[2], "vol": row[3]})

        for date_val, items in by_date.items():
            if not items:
                continue
            # Interpolate to 30 DTE
            below = [item for item in items if item["dte"] < 30]
            above = [item for item in items if item["dte"] >= 30]

            if below and above:
                item_below = max(below, key=lambda x: x["dte"])
                item_above = min(above, key=lambda x: x["dte"])
                d1, v1 = item_below["dte"], item_below["vol"]
                d2, v2 = item_above["dte"], item_above["vol"]
                if d2 == d1:
                    iv_30 = v1
                else:
                    iv_30 = v1 + (v2 - v1) * (30 - d1) / (d2 - d1)
            elif above:
                iv_30 = min(above, key=lambda x: x["dte"])["vol"]
            elif below:
                iv_30 = max(below, key=lambda x: x["dte"])["vol"]
            else:
                iv_30 = None

            if iv_30 is not None:
                iv_30_dict[ticker][date_val] = iv_30

    # Now calculate IV Rank and build SQL statements for Turso
    turso_sqls = []
    created_at = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')

    for ticker in tickers:
        ticker_dates = sorted(list(iv_30_dict[ticker].keys()))
        if not ticker_dates:
            continue

        for d_idx, date_val in enumerate(ticker_dates):
            start_idx = max(0, d_idx - 90)
            window_dates = ticker_dates[start_idx:d_idx+1]
            window_ivs = [iv_30_dict[ticker][d] for d in window_dates]

            if not window_ivs:
                continue

            current_iv = iv_30_dict[ticker][date_val]
            min_iv = min(window_ivs)
            max_iv = max(window_ivs)

            if max_iv == min_iv:
                iv_rank = 50.0
            else:
                iv_rank = (current_iv - min_iv) / (max_iv - min_iv) * 100.0

            turso_sqls.append(f"""
                INSERT OR REPLACE INTO market_iv_rank (ticker, date, iv_rank, current_iv, min_iv, max_iv, created_at)
                VALUES ('{ticker}', '{date_val}', {iv_rank:.4f}, {current_iv:.4f}, {min_iv:.4f}, {max_iv:.4f}, '{created_at}')
            """)

        # Also, insert term structure for the latest date of each ticker
        latest_date = ticker_dates[-1]
        cursor.execute("""
            SELECT expiry, dte, volatility, implied_move_perc
            FROM term_structure
            WHERE ticker = ? AND date = ? AND volatility IS NOT NULL
        """, (ticker, latest_date))

        for row in cursor.fetchall():
            expiry, dte, vol, im_perc = row
            im_perc_val = f"{im_perc:.4f}" if im_perc is not None else "NULL"
            turso_sqls.append(f"""
                INSERT OR REPLACE INTO market_iv_term_structure (ticker, date, expiry, dte, volatility, implied_move_perc, created_at)
                VALUES ('{ticker}', '{latest_date}', '{expiry}', {dte}, {vol:.4f}, {im_perc_val}, '{created_at}')
            """)

    conn.close()

    logger.info(f"Uploading {len(turso_sqls)} volatility rank and term structure records to Turso...")
    chunk_size = 100
    for i in range(0, len(turso_sqls), chunk_size):
        chunk = turso_sqls[i:i+chunk_size]
        res = turso_execute_many(chunk)
        if "error" in res:
            logger.error(f"Failed to upload volatility metrics chunk: {res['error']}")
            return

    logger.info("Successfully completed Turso volatility upload.")


async def main():
    logger.info("Starting historical implied volatility bootstrap...")

    # Ensure base directory exists
    BASE_DIR.mkdir(parents=True, exist_ok=True)
    RAW_JSON_DIR.mkdir(parents=True, exist_ok=True)

    # Initialize the database
    init_database()

    headers = get_headers()

    async with aiohttp.ClientSession() as session:
        # Step 1: Query latest term structure for AAPL to get valid expiries and trading dates
        logger.info("Fetching latest term structure for AAPL to determine trading dates...")
        url = f"{BASE_URL}/api/stock/AAPL/volatility/term-structure"
        aapl_latest = await fetch_with_retry(session, url, headers=headers, label="AAPL latest term structure")

        if not aapl_latest or "data" not in aapl_latest or not aapl_latest["data"]:
            logger.error("Could not fetch latest term structure for AAPL! Setup failed.")
            sys.exit(1)

        aapl_expiries = [item.get("expiry") for item in aapl_latest["data"] if item.get("expiry")]
        logger.info(f"Found {len(aapl_expiries)} active expiries for AAPL. Expiries: {aapl_expiries[:10]}...")

        # Pick the first active expiry to get standard historical trading days
        sample_expiry = aapl_expiries[1] if len(aapl_expiries) > 1 else aapl_expiries[0]
        logger.info(f"Querying historical risk reversal skew for AAPL expiry {sample_expiry} (delta 25) to extract historical trading days...")

        skew_url = f"{BASE_URL}/api/stock/AAPL/historical-risk-reversal-skew"
        params = {"expiry": sample_expiry, "delta": "25"}
        skew_history = await fetch_with_retry(session, skew_url, params=params, headers=headers, label="AAPL skew history")

        if not skew_history or "data" not in skew_history or not skew_history["data"]:
            logger.error("Could not fetch historical skew to extract trading dates! Setup failed.")
            sys.exit(1)

        # Extract unique dates sorted descending
        trading_days = sorted(list(set(item.get("date") for item in skew_history["data"] if item.get("date"))), reverse=True)
        logger.info(f"Retrieved {len(trading_days)} historical trading days.")

        # Select the most recent 90 trading days
        target_dates = trading_days[:90]
        logger.info(f"Selected {len(target_dates)} target trading days for bootstrapping (from {target_dates[-1]} to {target_dates[0]}).")

        # Create Semaphore to limit concurrent HTTP requests
        sem = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

        # Store counts of operations
        term_structure_success_count = 0
        skew_success_count = 0

        # Helper to fetch and store a daily term structure
        async def process_daily_term_structure(ticker, date):
            nonlocal term_structure_success_count
            async with sem:
                url = f"{BASE_URL}/api/stock/{ticker}/volatility/term-structure"
                params = {"date": date}
                data = await fetch_with_retry(
                    session, url, params=params, headers=headers,
                    label=f"term_structure {ticker} {date}"
                )
                if data and "data" in data and data["data"]:
                    # Save json archive
                    await save_raw_json(ticker, "term_structure", f"term_structure_{date}", data)
                    # Write to database
                    inserted = insert_term_structure_to_db(ticker, date, data["data"])
                    term_structure_success_count += inserted
                    logger.debug(f"Inserted {inserted} term structure rows for {ticker} on {date}")
                else:
                    logger.warning(f"No term structure data returned for {ticker} on {date}")

        # Helper to fetch and store historical skew for a given expiry and delta
        async def process_historical_skew(ticker, expiry, delta):
            nonlocal skew_success_count
            async with sem:
                url = f"{BASE_URL}/api/stock/{ticker}/historical-risk-reversal-skew"
                params = {"expiry": expiry, "delta": str(delta)}
                data = await fetch_with_retry(
                    session, url, params=params, headers=headers,
                    label=f"skew {ticker} {expiry} delta_{delta}"
                )
                if data and "data" in data and data["data"]:
                    # Save json archive
                    await save_raw_json(ticker, "skew", f"skew_{expiry}_d{delta}", data)

                    # Insert records into SQLite
                    conn = sqlite3.connect(DB_PATH)
                    cursor = conn.cursor()
                    inserted = 0
                    for r in data["data"]:
                        try:
                            # Note: The raw data contains: date, ticker, delta, risk_reversal
                            date_val = r.get("date")
                            rr_val = r.get("risk_reversal")
                            if date_val and date_val in target_dates: # Keep only inside our 90 trading days window
                                rr = float(rr_val) if rr_val is not None else None
                                cursor.execute("""
                                    INSERT OR REPLACE INTO skew (ticker, date, expiry, delta, risk_reversal)
                                    VALUES (?, ?, ?, ?, ?)
                                """, (ticker, date_val, expiry, int(delta), rr))
                                inserted += 1
                        except Exception as e:
                            logger.debug(f"Error inserting skew: {e}")
                    conn.commit()
                    conn.close()
                    skew_success_count += inserted
                    logger.debug(f"Inserted {inserted} skew rows for {ticker} expiry {expiry} delta {delta}")
                else:
                    logger.warning(f"No skew data returned for {ticker} expiry {expiry} delta {delta}")

        # Step 2: Fetch latest term structure for each of the top 15 tickers to discover their expirations
        logger.info("Discovering active expirations for all 15 tickers...")
        ticker_expiries = {}
        for ticker in TICKERS:
            url = f"{BASE_URL}/api/stock/{ticker}/volatility/term-structure"
            latest_data = await fetch_with_retry(session, url, headers=headers, label=f"{ticker} latest term structure")
            if latest_data and "data" in latest_data and latest_data["data"]:
                # Save latest term structure JSON
                await save_raw_json(ticker, "term_structure", "latest_term_structure", latest_data)
                # Parse expiries
                expiries = [item.get("expiry") for item in latest_data["data"] if item.get("expiry")]
                # Store top 6 nearest expiries to limit total requests while capturing the most relevant short-term term structures
                ticker_expiries[ticker] = expiries[:6]
                logger.info(f" - {ticker}: Found {len(expiries)} active expiries. Selected top 6: {expiries[:6]}")
                # Insert the latest term structure into DB as well
                today_date = latest_data["data"][0].get("date")
                insert_term_structure_to_db(ticker, today_date, latest_data["data"])
            else:
                logger.error(f"Failed to discover expiries for {ticker}!")
                ticker_expiries[ticker] = []

        # Step 3: Build list of daily term structure tasks
        logger.info(f"Building daily term structure download tasks for 15 tickers across {len(target_dates)} trading days...")
        term_structure_tasks = []
        for ticker in TICKERS:
            for date in target_dates:
                term_structure_tasks.append(process_daily_term_structure(ticker, date))

        # Step 4: Build list of historical skew tasks
        logger.info("Building historical skew download tasks for 15 tickers across their active expiries and deltas (10 and 25)...")
        skew_tasks = []
        for ticker in TICKERS:
            expiries_to_query = ticker_expiries.get(ticker, [])
            for expiry in expiries_to_query:
                for delta in [10, 25]:
                    skew_tasks.append(process_historical_skew(ticker, expiry, delta))

        # Step 5: Execute daily term structure fetches in batches
        logger.info(f"Executing {len(term_structure_tasks)} daily term structure requests in parallel...")
        start_ts = datetime.now()
        await asyncio.gather(*term_structure_tasks)
        end_ts = datetime.now()
        logger.info(f"Daily term structure download complete in {end_ts - start_ts}")

        # Step 6: Execute historical skew fetches in batches
        logger.info(f"Executing {len(skew_tasks)} historical skew requests in parallel...")
        start_skew = datetime.now()
        await asyncio.gather(*skew_tasks)
        end_skew = datetime.now()
        logger.info(f"Historical skew download complete in {end_skew - start_skew}")

        # Step 7: Verify data coverage and size of database
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM term_structure")
        total_ts_rows = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM skew")
        total_skew_rows = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(DISTINCT ticker) FROM term_structure")
        ts_tickers = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(DISTINCT ticker) FROM skew")
        skew_tickers = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(DISTINCT date) FROM term_structure")
        ts_dates = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(DISTINCT date) FROM skew")
        skew_dates = cursor.fetchone()[0]

        conn.close()

        db_size_mb = os.path.getsize(DB_PATH) / (1024 * 1024)

        logger.info("=" * 60)
        logger.info("🎉 BOOTSTRAPPING PROCESS COMPLETE!")
        logger.info("=" * 60)
        logger.info(f"SQLite Seed Database Path: {DB_PATH}")
        logger.info(f"Database File Size:        {db_size_mb:.2f} MB")
        logger.info(f"Raw JSON Archives Path:    {RAW_JSON_DIR}")
        logger.info(f"Daily Term Structure:      {total_ts_rows} rows inserted ({ts_tickers}/15 tickers, {ts_dates} distinct trading days)")
        logger.info(f"Historical Skew:           {total_skew_rows} rows inserted ({skew_tickers}/15 tickers, {skew_dates} distinct trading days)")
        logger.info("=" * 60)

        # Run IV Rank Solver and log to Turso
        calculate_and_log_iv_metrics()


if __name__ == "__main__":
    if not UW_API_KEY:
        print("Error: UNUSUAL_WHALES_API_KEY environment variable is not set!")
        sys.exit(1)
    asyncio.run(main())
