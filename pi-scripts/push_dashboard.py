#!/usr/bin/env python3
"""
Definitive dashboard data generator — uses yfinance historical closes for entry prices.
Bypasses ALL Pi CAD/USD confusion by getting prices directly from the market.
"""
import json, os, datetime, subprocess, sys, math, yfinance as yf, pandas as pd
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from yfinance_session import download as yf_download, ticker as yf_ticker
from publish_policy import enforce_private_pages_exclusion, pages_excludes

LEDGER = os.path.expanduser("~/.hermes/market-intel/paper_trading.json")
DEMO_ACCOUNT = os.path.expanduser("~/.hermes/market-intel/demo_account.json")
DASHBOARD_REPO = os.path.expanduser("~/morning-briefing")
DASHBOARD_DATA = os.path.join(DASHBOARD_REPO, "data", "paper_trades.json")

DEMO_BALANCE_THRESHOLD = 5000  # Use demo account if balance exceeds this

# Ticker → display ticker (to show .TO suffix for TSX stocks on dashboard)
DISPLAY_MAP = {
    "TD": "TD.TO", "RY": "RY.TO", "BNS": "BNS.TO", "BMO": "BMO.TO",
    "CM": "CM.TO", "NA": "NA.TO", "CNQ": "CNQ.TO", "XEI": "XEI.TO",
    "LAR": "LAR.TO", "BTCC-B": "BTCC-B.TO", "CBIT": "CBIT.TO",
    "LAC": "LAC.TO", "AC": "AC.TO", "DMGI": "DMGI.TO",
    "SLF": "SLF.TO", "MFC": "MFC.TO", "ENB": "ENB.TO", "TRP": "TRP.TO",
    "SU": "SU.TO", "CVE": "CVE.TO", "SHOP": "SHOP.TO",
}
# Ticker → yfinance symbol (to use .TO for TSX price lookup)
YF_MAP = dict(DISPLAY_MAP)  # same mapping works for both display and yfinance
# Known US-listed tickers (prices in USD)
US = {"XLC","MSTR","TLT","XLP","SLV","EFA","SPY","QQQ","IWM","XLF","XLK","XLE",
      "XLV","XLI","XLU","IAU","GLD","FXY","DBC","DBA",
      "AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","AMD","PLTR",
      "AVGO","NFLX","ADBE","CRM","ORCL","CAT","GE","MCD","KO","PEP","WMT","JPM",
      "GS","V","MA","UNH","JNJ","PFE","MRK","ABBV","LLY","NKE","IBIT"}
# Canadian tickers — all use .TO suffix for consistency
CA = {"CNQ.TO","TD.TO","XEI.TO","LAR.TO","BTCC-B.TO","BES.V","CBIT.TO","RY.TO",
      "BNS.TO","BMO.TO","CM.TO","NA.TO","LAC.TO","AC.TO","DMGI.TO"}

FOREX_TICKERS = {"FXY", "UUP", "FXA", "FXE", "FXB", "FXF", "FXC", "CYB"}

def is_canadian_ticker(ticker):
    """Check if a ticker is Canadian-listed."""
    t = ticker.upper().strip()
    if t.endswith(".TO") or t.endswith(".V"):
        return True
    base = t.replace(".TO", "").replace(".V", "").replace("-", "")
    return base in {"CNQ", "TD", "XEI", "LAR", "BTCCB", "CBIT", "RY", "BNS", "BMO", "CM", "NA", "LAC", "AC", "DMGI", "BES", "SLF", "MFC", "ENB", "TRP", "SU", "CVE", "SHOP"}

_AC_CRYPTO = {"IBIT", "BTCUSD", "BTC", "ETHUSD", "ETH", "SOLUSD", "SOL", "XRPUSD", "XRP",
              "BITO", "GBTC", "ETHE", "BITX", "BITI", "BTF", "DEFI", "MSTR"}
_AC_COMMODITY = {"GLD", "SLV", "IAU", "USO", "UNG", "DBC", "DBA", "PDBC", "GSG", "PPLT",
                 "PALL", "CORN", "WEAT", "SOYB"}
_AC_BOND = {"TLT", "IEF", "SHY", "HYG", "LQD", "AGG", "BND", "TIP", "BIL", "SHV",
            "MBB", "VCIT", "VCSH", "EMB", "GOVT", "SPTL", "SPTS"}
_AC_ETF = {"SPY", "QQQ", "IWM", "VOO", "VTI", "DIA", "XLF", "XLE", "XLK", "XLV", "XLI",
           "XLP", "XLU", "XLB", "XLRE", "XLC", "EFA", "EEM", "VWO", "SMH", "SOXX",
           "JETS", "ICLN", "ARKK", "SCHD", "VYM", "XEI"}


def asset_class(ticker, trade_type=None):
    """Clean 6-way asset class matching the ledger: equity/etf/bond/commodity/
    crypto/forex/option. Bonds are split out from ETFs for a meaningful mix."""
    if trade_type == "option":
        return "option"
    t = ticker.upper().replace(".TO", "").replace("-", "").strip()
    if t in _AC_CRYPTO:
        return "crypto"
    if t in _AC_COMMODITY:
        return "commodity"
    if t in FOREX_TICKERS:
        return "forex"
    if t in _AC_BOND:
        return "bond"
    if t in _AC_ETF:
        return "etf"
    return "equity"

ASSET_TYPES = {"TLT":"ETF","TD.TO":"Stock","EFA":"ETF","SLV":"ETF","XLP":"ETF",
    "CNQ.TO":"Stock","XLC":"ETF","MSTR":"Stock","XLE":"ETF","XLU":"ETF",
    "IAU":"ETF","GLD":"ETF","FXY":"ETF","DBC":"ETF","DBA":"ETF",
    "IBIT":"ETF","SPY":"ETF","QQQ":"ETF","IWM":"ETF","NKE":"Stock",
    "JETS":"ETF","ICLN":"ETF","ON":"Stock",
    "RY.TO":"Stock","BNS.TO":"Stock","BMO.TO":"Stock","CM.TO":"Stock",
    "NA.TO":"Stock","XEI.TO":"ETF","LAR.TO":"Stock","BTCC-B.TO":"ETF",
    "CBIT.TO":"ETF","LAC.TO":"Stock","AC.TO":"Stock","DMGI.TO":"Stock",
    "BES.V":"Stock","SLF.TO":"Stock","MFC.TO":"Stock","ENB.TO":"Stock",
    "TRP.TO":"Stock","SU.TO":"Stock","CVE.TO":"Stock","SHOP.TO":"Stock"}


def json_safe(value):
    """Replace non-finite floats so dashboard writes cannot abort a publish run."""
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {key: json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [json_safe(item) for item in value]
    if isinstance(value, tuple):
        return [json_safe(item) for item in value]
    return value

# ── Currency Detection ────────────────────────────────
# Cache for yfinance currency lookups (avoids repeated info calls)
_CURRENCY_CACHE = {}

def ticker_currency(ticker, trade_currency=None):
    """Detect a ticker's trading currency.
    
    Priority:
    1. Trade's entry_currency field (reliable for post-fix trades)
    2. yfinance Ticker.info.currency (authoritative, cached)
    3. Hardcoded US set (legacy fallback)
    4. .TO suffix check
    """
    # Fast path: trade's metadata (reliable after source fix)
    if trade_currency in ("USD", "CAD"):
        return trade_currency
    
    # Fast path: .TO suffix
    if ticker.upper().endswith(".TO"):
        return "CAD"
    
    # Cached yfinance lookup
    if ticker in _CURRENCY_CACHE:
        return _CURRENCY_CACHE[ticker]
    
    try:
        tk = yf_ticker(yf, ticker)
        info = tk.info
        if info and info.get('currency') in ('USD', 'CAD'):
            cur = info['currency']
            _CURRENCY_CACHE[ticker] = cur
            return cur
    except Exception:
        pass
    
    # Legacy fallback: hardcoded sets
    cur = "USD" if ticker in US else "CAD"
    _CURRENCY_CACHE[ticker] = cur
    return cur

RATE = 1.38  # USDCAD fallback only — overwritten with the live rate at the top of main()

def dual_price(price, currency):
    """Convert a price to both USD and CAD.
    Returns (price_usd, price_cad) tuple."""
    if not price or float(price) == 0:
        return 0.0, 0.0
    p = float(price)
    if currency == "USD":
        return round(p, 2), round(p * RATE, 2)
    else:  # CAD
        return round(p / RATE, 2), round(p, 2)

def to_native(price, ticker, cur):
    """Convert Pi's raw price to native currency. Pi stores in CAD.
    For US tickers: ALWAYS divide by RATE (CAD→USD), ignoring entry_currency field.
    For CA tickers: keep as-is (already CAD). Used as fallback when entry_currency is wrong or missing."""
    if not price or float(price) == 0:
        return 0
    p = float(price)
    if ticker_currency(ticker) == "USD":
        return round(p / RATE, 2)
    return round(p, 2)

def get_native_currency(ticker, entry_currency=None):
    """Determine the TRUE native currency for a ticker.
    Uses entry_currency only if it matches the known market. Falls back to ticker-based detection."""
    if entry_currency in ("USD", "CAD"):
        return entry_currency
    return ticker_currency(ticker)

def get_entry_price(ticker, entry_date_str, raw_entry=None):
    """Get the ACTUAL entry price from yfinance historical data on the entry date.
    For today's entries, uses raw_entry (converted to native currency)."""
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    
    # For today's entries — use raw_entry (actual entry price), convert to native
    if entry_date_str == today:
        if raw_entry and raw_entry > 0:
            p = round(raw_entry, 2)
            curr = ticker_currency(ticker)
            if curr == "USD":
                p = round(p / RATE, 2)
            return p, curr
        return None, None
    
    try:
        yf_t = YF_MAP.get(ticker, ticker)
        start = (pd.Timestamp(entry_date_str) - pd.Timedelta(days=5)).strftime("%Y-%m-%d")
        end = (pd.Timestamp(entry_date_str) + pd.Timedelta(days=1)).strftime("%Y-%m-%d")
        d = yf_download(yf, yf_t, start=start, end=end, auto_adjust=False, progress=False)
        if d.empty: return None, None
        if isinstance(d.columns, type(d.columns)):
            d.columns = d.columns.get_level_values(0)
        entry = round(float(d["Close"].iloc[-1]), 2)
        if not math.isfinite(entry):
            return None, None
        curr = ticker_currency(ticker)
        return entry, curr
    except: return None, None

def get_current_price(ticker, entry_date_str=None, raw_entry=None):
    """Get current market price from yfinance. For today's entries, tries yfinance first (live/intraday
    close), falls back to raw_entry (same as entry, giving 0% same-day P&L)."""
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    
    # Try yfinance first for ALL entries — gives the actual current market price
    try:
        yf_t = YF_MAP.get(ticker, ticker)
        d = yf_download(yf, yf_t, period="5d", auto_adjust=False, progress=False)
        if not d.empty:
            if isinstance(d.columns, type(d.columns)):
                d.columns = d.columns.get_level_values(0)
            price = round(float(d["Close"].iloc[-1]), 2)
            curr = ticker_currency(ticker)
            if math.isnan(price) or math.isinf(price):
                return None, None
            return price, curr
    except:
        pass
    
    # Fallback for today's entries: use raw_entry (converted to native)
    if entry_date_str == today and raw_entry and raw_entry > 0:
        p = round(raw_entry, 2)
        curr = ticker_currency(ticker)
        if curr == "USD":
            p = round(p / RATE, 2)
        return p, curr

    return None, None

def load_demo_account():
    """Load and transform demo_account.json into paper_trading.json format.
    
    Returns transformed dict and risk_metrics if demo account exists and
    balance > DEMO_BALANCE_THRESHOLD, otherwise returns (None, None).
    """
    if not os.path.exists(DEMO_ACCOUNT):
        return None, None
    
    try:
        with open(DEMO_ACCOUNT) as f:
            demo = json.load(f)
    except (json.JSONDecodeError, OSError):
        return None, None
    
    balance = float(demo.get("balance", 0))
    if balance <= DEMO_BALANCE_THRESHOLD:
        return None, None
    
    # Build risk_metrics from sleeves data
    sleeves = demo.get("sleeves", {})
    risk_metrics = {
        "account_type": "demo",
        "total_balance": balance,
        "sleeves": {},
    }
    total_allocated = 0
    total_sleeve_pnl = 0.0
    for name, s in sleeves.items():
        alloc = float(s.get("allocated", 0))
        pnl = float(s.get("pnl", 0))
        total_allocated += alloc
        total_sleeve_pnl += pnl
        risk_metrics["sleeves"][name] = {
            "allocated": alloc,
            "pnl": pnl,
            "trades": s.get("trades", 0),
            "wins": s.get("wins", 0),
            "losses": s.get("losses", 0),
            "win_rate": round(s.get("wins", 0) / max(s.get("trades", 1), 1) * 100, 1),
        }
    risk_metrics["total_allocated"] = total_allocated
    risk_metrics["cash_reserve"] = balance - total_allocated
    risk_metrics["allocation_pct"] = round(total_allocated / balance * 100, 1) if balance > 0 else 0
    
    # Transform trades into paper_trading.json format
    all_trades = demo.get("trades", [])
    closed_trades = []
    open_trades = []
    wins = 0
    losses = 0
    
    for t in all_trades:
        status = t.get("status", "open")
        pnl = float(t.get("pnl", 0) or 0)
        ticker = t.get("ticker", "?")
        
        # Parse entry/exit times into dates
        entry_time = t.get("entry_time", "")
        exit_time = t.get("exit_time", "")
        entry_date = entry_time[:10] if entry_time else ""
        exit_date = exit_time[:10] if exit_time else ""
        
        trade_obj = {
            "ticker": ticker,
            "direction": t.get("direction", "long"),
            "entry_price": float(t.get("entry_price", 0)),
            "exit_price": float(t.get("exit_price", 0)),
            "entry_date": entry_date,
            "exit_date": exit_date,
            "strategy": t.get("strategy", "?"),
            "pnl": pnl,
            "size": t.get("size", 0),
            "quantity": t.get("size", 0),
            "sleeve": t.get("sleeve", ""),
            "score": t.get("score", 0),
            "entry_currency": "CAD" if is_canadian_ticker(ticker) else "USD",
        }
        
        if status == "closed":
            closed_trades.append(trade_obj)
            if pnl >= 0:
                wins += 1
            else:
                losses += 1
        else:
            open_trades.append(trade_obj)
    
    # Compute cash from sleeves or balance
    cash = sleeves.get("cash", {}).get("allocated", balance - total_allocated)
    
    # Starting balance: back out sleeve P&L from the current balance so
    # return_pct reflects actual gains (balance alone would make it ~0).
    starting_balance = balance - total_sleeve_pnl
    
    transformed = {
        "metadata": {
            "winning_trades": wins,
            "losing_trades": losses,
            "source": "demo_account",
        },
        "account": {
            "cash": cash,
            "starting_balance": starting_balance,
        },
        "open_trades": open_trades,
        "closed_trades": closed_trades,
        "risk_metrics": risk_metrics,
    }
    
    return transformed, risk_metrics


def main():
    global RATE
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # ── Fetch live USDCAD rate FIRST so every conversion below (dual_price,
    # to_native, get_entry_price, get_current_price) uses it; the module
    # default 1.38 is only the fallback when the fetch fails. Also published
    # as fx_rate_usdcad for the frontend currency toggle.
    try:
        fx_hist = yf_ticker(yf, "USDCAD=X").history(period="5d")
        if not fx_hist.empty:
            RATE = round(float(fx_hist["Close"].iloc[-1]), 4)
    except Exception:
        pass  # keep 1.38 fallback

    # ── Try demo account first (if balance > threshold) ──
    demo_data, risk_metrics = load_demo_account()
    if demo_data is not None:
        pt = demo_data
        print(f"Using demo account: ${float(demo_data['account']['starting_balance']):,.2f}")
    else:
        if not os.path.exists(LEDGER):
            print("No ledger")
            return
        with open(LEDGER) as f:
            pt = json.load(f)
        risk_metrics = None
        print("Using paper_trading.json (demo account not available or balance < $5,000)")
    
    meta = pt.get("metadata", {})
    acct = pt.get("account", {})
    is_demo = meta.get("source") == "demo_account"
    wins = meta.get("winning_trades", 0) or 0
    losses = meta.get("losing_trades", 0) or 0
    total = wins + losses
    wr = round(wins / total * 100, 1) if total > 0 else 0
    cash = round(float(acct.get("cash", 0)), 2)
    start = float(acct.get("starting_balance", 2000))
    
    # ── Compute closed trade P&L from yfinance ──
    # Process ALL closed trades for P&L, but only show last 20
    all_closed = pt.get("closed_trades", [])
    recent = []
    realized_pnl = 0.0
    for c in all_closed[-40:]:  # process up to 40 for P&L (yfinance is slow)
        ticker = c.get('ticker','?')
        yf_t = YF_MAP.get(ticker, ticker)
        cur = ticker_currency(ticker, c.get("entry_currency", ""))
        qty = float(c.get('quantity') or 1)
        qty = int(qty) if qty.is_integer() else qty
        
        entry_date = str(c.get('entry_date',''))[:10]
        exit_date = str(c.get('exit_date',''))[:10]
        
        # Get yfinance close on entry and exit dates
        entry_price, exit_price = None, None
        
        # For today's entries: prefer ledger's entry_price_usd when available (correct after fix_ledger_pnl)
        today_str = datetime.datetime.now().strftime("%Y-%m-%d")
        if entry_date == today_str:
            usd_entry = c.get("entry_price_usd")
            if usd_entry and cur == "USD":
                entry_price = round(float(usd_entry), 2)
            else:
                raw_entry = float(c.get("entry_price_cad", c.get("entry_price", 0)))
                ep, _ = get_entry_price(ticker, entry_date, raw_entry)
                entry_price = ep
        else:
            if entry_date:
                ep, _ = get_entry_price(ticker, entry_date)
                entry_price = ep
        if exit_date:
            try:
                end = (pd.Timestamp(exit_date) + pd.Timedelta(days=2)).strftime('%Y-%m-%d')
                dx = yf_download(yf, yf_t, start=exit_date, end=end, auto_adjust=False, progress=False)
                if not dx.empty:
                    if isinstance(dx.columns, pd.MultiIndex):
                        dx.columns = dx.columns.get_level_values(0)
                    exit_price = round(float(dx['Close'].iloc[-1]), 2)
            except:
                pass
        
        # Fallback: to_native on Pi's raw prices if yfinance fails
        raw_entry = float(c.get('entry_price', 0) or 0)
        raw_exit = float(c.get('exit_price', 0) or 0)
        if entry_price is None:
            entry_price = to_native(raw_entry, ticker, cur)
        if exit_price is None:
            exit_price = to_native(raw_exit, ticker, cur)
        
        pnl_pct = round((exit_price - entry_price) / entry_price * 100, 2) if entry_price > 0 else 0
        # Position-level P&L: per-share move × share count from the ledger
        pnl_usd = round((exit_price - entry_price) * qty, 2)
        realized_pnl += pnl_usd

        display_ticker = DISPLAY_MAP.get(ticker, ticker)
        entry_usd, entry_cad = dual_price(entry_price, cur)
        exit_usd, exit_cad = dual_price(exit_price, cur)
        recent.append({
            'ticker': display_ticker,
            'quantity': qty,
            'type': ASSET_TYPES.get(display_ticker, 'ETF'),
            'asset_class': asset_class(ticker, c.get('trade_type', 'stock')),
            'direction': c.get('direction','?'),
            'pnl_pct': pnl_pct,
            'pnl_usd': pnl_usd,
            'entry_price': entry_price,
            'exit_price': exit_price,
            'currency': cur,
            'entry_price_usd': entry_usd,
            'entry_price_cad': entry_cad,
            'exit_price_usd': exit_usd,
            'exit_price_cad': exit_cad,
            'strategy': c.get('strategy','?'),
            'entry_date': str(c.get('entry_date','')),
            'exit_date': str(c.get('exit_date','')),
            'rationale': c.get('rationale', ''),
            'exit_rationale': c.get('exit_rationale', ''),
        })
    
    # Add any older trades not processed by yfinance (ledger P&L, less reliable)
    if len(all_closed) > 40:
        for c in all_closed[:-40]:
            realized_pnl += float(c.get('pnl', 0) or 0)
    
    # Only show last 20 for display
    recent = recent[-20:]
    
    # Row-based sum kept only as the demo-account fallback; the ledger path
    # derives realized P&L from the cash identity further down.
    realized_pnl = round(realized_pnl, 2)

    # Build open positions from yfinance historical data
    positions = []
    # Check if trade has explicit currency — use it instead of guessing
    for t in pt.get("open_trades", []):
        ticker = t.get("ticker", "?")
        cur = ticker_currency(ticker, t.get("entry_currency", ""))
        trade_type = t.get("trade_type", "stock")
        ac = t.get("asset_class") or asset_class(ticker, trade_type)
        
        entry_date = str(t.get("entry_date", ""))[:10]
        strategy = t.get("strategy", t.get("entry_rationale", "?"))
        raw_entry = float(t.get("entry_price_cad", t.get("entry_price", 0)))
        # Share/contract count and dollars the engine actually debited from cash.
        # The ledger stores both (paper_trading.py debits entry_value on entry);
        # fall back to price×qty only for pre-fix trades that lack entry_value.
        qty = float(t.get("quantity") or 1)
        qty = int(qty) if qty.is_integer() else qty
        ledger_entry_value = float(t.get("entry_value") or 0) or round(float(t.get("entry_price") or 0) * qty, 2)

        # Options: use premium as-is, don't fetch underlying price
        if trade_type == "option":
            premium = float(t.get("entry_price", 0))
            strike = t.get("strike")
            expiration = t.get("expiration", "")
            days_to_expiry = 0
            if expiration:
                try:
                    exp_dt = datetime.datetime.strptime(str(expiration)[:10], "%Y-%m-%d")
                    days_to_expiry = max(0, (exp_dt - datetime.datetime.now()).days)
                except (ValueError, TypeError):
                    pass
            positions.append({
                'ticker': DISPLAY_MAP.get(ticker, ticker),
                'type': 'Option',
                'entry_date': entry_date,
                'entry_price': premium,
                # No live option pricing — current_price is just the entry
                # premium; flag it so the frontend can show a dash, not $0 P&L.
                'current_price': premium,
                'premium_stale': True,
                'currency': 'USD',
                'quantity': qty,
                'entry_value': ledger_entry_value,
                'market_value': ledger_entry_value,
                'pnl': 0.0,
                'pnl_pct': 0.0,
                'strategy': strategy,
                'direction': t.get('direction', 'long'),
                'rationale': t.get('rationale', ''),
                'asset_class': ac,
                'option_strike': strike,
                'option_expiration': str(expiration)[:10] if expiration else None,
                'option_days_to_expiry': days_to_expiry,
            })
            continue
        
        # For today's entries: prefer entry_price_usd when available (avoids FX rate approximation)
        today_str = datetime.datetime.now().strftime("%Y-%m-%d")
        if entry_date == today_str:
            usd_entry = t.get("entry_price_usd")
            if usd_entry and ticker_currency(ticker) == "USD":
                entry_price = round(float(usd_entry), 2)
            else:
                entry_price, _ = get_entry_price(ticker, entry_date, raw_entry)
        else:
            entry_price, _ = get_entry_price(ticker, entry_date, raw_entry)
        
        if entry_price is None:
            # Fall back to normalize prices (last resort)
            entry_price = round(float(t.get("entry_price_usd", t.get("entry_price", 0))), 2)
            if cur not in ("USD", "CAD"):
                cur = ticker_currency(ticker)
        
        current_price = get_current_price(ticker, entry_date, raw_entry)
        if isinstance(current_price, tuple):
            current_price = current_price[0]
        if current_price is None:
            current_price = entry_price
        
        pnl_pct = round((current_price - entry_price) / entry_price * 100, 2) if entry_price > 0 else 0
        display = DISPLAY_MAP.get(ticker, ticker)
        asset = "Stock" if ticker in CA or ticker == "MSTR" else "ETF"
        
        entry_usd, entry_cad = dual_price(entry_price, cur)
        current_usd, current_cad = dual_price(current_price, cur)
        positions.append({
            'ticker': display,
            'type': asset,
            'entry_date': entry_date,
            'entry_price': entry_price,
            'current_price': current_price,
            'currency': cur,
            'entry_price_usd': entry_usd,
            'entry_price_cad': entry_cad,
            'current_price_usd': current_usd,
            'current_price_cad': current_cad,
            'quantity': qty,
            'entry_value': ledger_entry_value,
            'market_value': round(current_price * qty, 2),
            'pnl': round((current_price - entry_price) * qty, 2),
            'pnl_pct': pnl_pct,
            'strategy': strategy,
            'direction': 'long',
            'rationale': t.get('rationale', ''),
            'asset_class': ac,
        })
    
    # Compute portfolio stats from actual positions, at full position size.
    # invested = dollars debited from cash (cost basis), market_value = what the
    # open book is worth now.
    invested = round(sum(float(p.get('entry_value') or 0) for p in positions), 2)
    market_value = round(sum(float(p.get('market_value') or 0) for p in positions), 2)
    unrealized_pnl = round(market_value - invested, 2)
    # Realized P&L from the cash ledger identity (cash = start − Σopen cost +
    # Σclosed realized), not from summing closed-trade rows: closed trades get
    # archived out of paper_trading.json, so a row sum silently loses history.
    if not is_demo:
        realized_pnl = round(cash + invested - start, 2)
    realized_pnl = round(realized_pnl, 2)
    total_pnl_val = round(realized_pnl + unrealized_pnl, 2)
    return_pct = round(total_pnl_val / start * 100, 2) if start > 0 else 0

    # Asset-class mix (count + invested value per class) so the Positions page
    # can show the true multi-asset breakdown.
    _mix = {}
    for _p in positions:
        _cls = _p.get("asset_class", "equity")
        _m = _mix.setdefault(_cls, {"count": 0, "value": 0.0})
        _m["count"] += 1
        _m["value"] += float(_p.get("entry_value", 0) or 0)
    _mix_total = sum(m["value"] for m in _mix.values()) or 1.0
    asset_class_mix = {
        k: {"count": v["count"], "value": round(v["value"], 2),
            "pct": round(v["value"] / _mix_total * 100, 1)}
        for k, v in sorted(_mix.items(), key=lambda kv: -kv[1]["value"])
    }

    live_data = {
        'status': 'LIVE',
        'generated_at': now,
        'price_source': 'yfinance historical closes — no CAD/USD math',
        # Live rate fetched once at the top of main(); 1.38 only if the fetch failed.
        'fx_rate_usdcad': RATE,
        'portfolio': {
            'starting_balance': start, 'cash': cash,
            'invested': invested,
            'market_value': market_value,
            # True account value: cash on hand + open book marked to market.
            # Identical to starting_balance + total_pnl by the cash identity.
            'total_balance': round(cash + market_value, 2),
            'realized_pnl': realized_pnl,
            'total_pnl': total_pnl_val,
            'unrealized_pnl': unrealized_pnl,
            'return_pct': return_pct,
            'win_rate': wr, 'total_trades': total,
        },
        'active_strategy': 'V23 VIX>=12 MR',
        'asset_class_mix': asset_class_mix,
        'open_positions': positions,
        'recent_trades': recent,
    }
    
    # Merge risk_metrics from demo account if available
    if risk_metrics is not None:
        live_data['risk_metrics'] = risk_metrics
    
    # Write to dashboard repo
    os.makedirs(os.path.dirname(DASHBOARD_DATA), exist_ok=True)
    with open(DASHBOARD_DATA, "w") as f:
        json.dump(json_safe(live_data), f, indent=2, allow_nan=False)
    
    # Update prediction engine accuracy (runs before git push)
    accuracy_script = os.path.expanduser("~/.hermes/scripts/update_prediction_accuracy.py")
    if os.path.exists(accuracy_script):
        r = subprocess.run([sys.executable, accuracy_script], capture_output=True, text=True, timeout=30)
        if r.returncode == 0:
            for line in r.stdout.strip().split('\n'):
                if line.strip():
                    print(f"  {line}")
        else:
            print(f"WARNING: Accuracy update failed: {r.stderr[:200]}")
    
    # Push Reddit sentiment data
    reddit_script = os.path.expanduser("~/.hermes/scripts/push_reddit.py")
    if os.path.exists(reddit_script):
        r = subprocess.run([sys.executable, reddit_script], capture_output=True, text=True, timeout=30)
        if r.returncode == 0:
            for line in r.stdout.strip().split('\n'):
                if line.strip():
                    print(f"  {line}")
    
    
    # Generate latest.json for dashboard
    gen_latest = os.path.expanduser("~/.hermes/scripts/generate_latest.py")
    if os.path.exists(gen_latest):
        r = subprocess.run([sys.executable, gen_latest], capture_output=True, text=True, timeout=60)
        if r.returncode == 0:
            for line in r.stdout.strip().split('\n'):
                if line.strip():
                    print(f"  {line}")
    
    
    # Snapshot into archive (once daily)
    archive_script = os.path.expanduser("~/.hermes/scripts/archive_snapshot.py")
    if os.path.exists(archive_script):
        r = subprocess.run([sys.executable, archive_script], capture_output=True, text=True, timeout=30)
        if r.returncode == 0:
            for line in r.stdout.strip().split('\n'):
                if line.strip():
                    print(f"  {line}")
    
    # Generate GEX/DEX/VEX data for dashboard
    gex_script = os.path.expanduser("~/.hermes/scripts/push_gex.py")
    if os.path.exists(gex_script):
        r = subprocess.run([sys.executable, gex_script], capture_output=True, text=True, timeout=120)
        if r.returncode == 0:
            for line in r.stdout.strip().split('\n'):
                if line.strip():
                    print(f"  {line}")
    
    # Push to GitHub
    if os.path.exists(DASHBOARD_REPO):
        os.chdir(DASHBOARD_REPO)
        r = subprocess.run("git pull --rebase --autostash origin main", shell=True, capture_output=True, text=True)
        if r.returncode != 0:
            print(f"GIT PULL FAILED: {r.stderr or r.stdout}")
            sys.exit(1)
        # Paywall: regenerate public screener-lite + sync premium files to R2
        try:
            sys.path.insert(0, os.path.expanduser("~/.hermes/scripts"))
            import r2_sync
            _uploaded, _skipped = r2_sync.run()
            if _skipped:
                raise RuntimeError(f"R2 sync skipped {_skipped} private artifact(s)")
            if os.path.exists(os.path.join(DASHBOARD_REPO, 'data', 'nope-detail.json')) and not _uploaded:
                raise RuntimeError("NOPE artifact exists but private R2 upload did not run")
        except Exception as _e:
            raise RuntimeError(f"Private R2 sync failed; refusing to publish Pages data: {_e}") from _e
        # Sync data/ → public/data/ for Cloudflare Pages static export
        # (next.config.ts output:'export'), EXCLUDING premium files — those are
        # R2-only and must never land in the deployed static dir.
        _rsync_cmd = ['rsync', '-a']
        try:
            import r2_sync as _rs
            _private_files = _rs.PRIVATE_FILES
            for _f in pages_excludes(_private_files):
                _rsync_cmd += ['--exclude', _f]
        except Exception:
            raise RuntimeError("Private R2 policy unavailable; refusing to publish Pages data")
        _rsync_cmd += [os.path.join(DASHBOARD_REPO, 'data/'), os.path.join(DASHBOARD_REPO, 'public/data/')]
        _sync_result = subprocess.run(_rsync_cmd, capture_output=True, text=True)
        if _sync_result.returncode != 0:
            raise RuntimeError(f"Pages data sync failed: {_sync_result.stderr}")
        # Remove private files from public/data ONLY (stale copies from previous
        # deploys). KEEP the data/ working copies: they are gitignored (never
        # deployed) and are the live inputs for the Pi's own downstream jobs —
        # audio briefing (web-news.json), council trade executor
        # (maplegamma_analysis.json), intraday councils (morning_analysis.json),
        # publish_ticker_details (screener-data.json). Deleting them starved all
        # four from Jul 10–13 (no audio after Jul 10, executor A "No council
        # output" 15 min after the council wrote its file).
        enforce_private_pages_exclusion(DASHBOARD_REPO, _private_files)
        _stage_result = subprocess.run("git add -A", shell=True, capture_output=True, text=True)
        if _stage_result.returncode != 0:
            raise RuntimeError(f"Git staging failed; refusing to publish: {_stage_result.stderr or _stage_result.stdout}")
        ts = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
        _commit_result = subprocess.run(
            f'git commit -m "Live portfolio {ts}"', shell=True, capture_output=True, text=True,
        )
        _nothing_to_commit = "nothing to commit" in (_commit_result.stderr + _commit_result.stdout).lower()
        if _commit_result.returncode != 0 and not _nothing_to_commit:
            raise RuntimeError(f"Git commit failed; refusing to publish: {_commit_result.stderr or _commit_result.stdout}")
        # A prior push can fail after a successful commit. Always retry push so a
        # later no-op run still publishes that local private-data deletion.
        _push_result = subprocess.run("git push origin main", shell=True, capture_output=True, text=True)
        if _push_result.returncode != 0:
            raise RuntimeError(f"Git push failed: {_push_result.stderr or _push_result.stdout}")
    
    print(f"Pushed {len(positions)} positions — all prices from yfinance:")
    for p in positions:
        print(f"  {p['ticker']:8s} entry=${p['entry_price']:.2f} {p['currency']} → ${p['current_price']:.2f} ({p['pnl_pct']:+.2f}%)")

if __name__ == "__main__":
    main()
