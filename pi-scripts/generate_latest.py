#!/usr/bin/env python3
"""Generate latest.json for the briefing dashboard from available Pi data."""
import json, os, datetime
from pathlib import Path

import yfinance as yf

CACHE = Path(os.path.expanduser("~/.hermes/briefing-cache"))
MARKET_INTEL = Path(os.path.expanduser("~/.hermes/market-intel"))
DASHBOARD_REPO = Path(os.path.expanduser("~/morning-briefing"))
OUTPUT = DASHBOARD_REPO / "data" / "latest.json"

def load_json(path):
    try:
        with open(path) as f:
            return json.load(f)
    except: return None

def safe_float(v, default=0):
    try: return round(float(v), 2)
    except: return default

def to_iso(v):
    """Normalise a news date to ISO 8601 with a UTC offset.

    RSS carries RFC 2822 ("Thu, 23 Jul 2026 15:31:00 GMT"). The dashboard's
    fmtTs only converts a timestamp to ET when it can see a Z/±HH:MM offset;
    handed the raw RFC string it falls through to its naive-wall-time branch
    and renders "Thu, 23 Jul 2026 ET", labelling a GMT time as Eastern.
    Normalising here keeps that mislabelling off the page.
    """
    if not v:
        return ""
    v = str(v).strip()
    try:
        from email.utils import parsedate_to_datetime
        return parsedate_to_datetime(v).isoformat()
    except (TypeError, ValueError):
        pass
    try:  # already ISO 8601?
        return datetime.datetime.fromisoformat(v.replace("Z", "+00:00")).isoformat()
    except (TypeError, ValueError):
        return ""

now = datetime.datetime.now()
ts = now.strftime("%Y-%m-%dT%H:%M:%S-04:00")

data = {
    "generated_at": ts,
    "market_summary": {},
    "narrative": {},
    "watchlist_summary": {},
    "central_banks": {"fed": "", "boc": ""},
    "insider_trades": [],
    "market_news": {"headlines": [], "earnings": [], "analyst_ratings": []},
    "geopolitical": [],
}

# Indices from yfinance
indices_config = [
    ("^GSPC", "S&P 500"), ("^DJI", "Dow Jones"), ("^IXIC", "NASDAQ"),
    ("^GSPTSE", "TSX"), ("^VIX", "VIX"), ("^TNX", "10Y Yield"),
]
indices = []
for symbol, name in indices_config:
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="5d")
        if not hist.empty:
            price = safe_float(hist["Close"].iloc[-1])
            prev = safe_float(hist["Close"].iloc[-2]) if len(hist) > 1 else price
            change_pct = round((price - prev) / prev * 100, 2) if prev else 0
            indices.append({"ticker": name, "price": price, "change_pct": change_pct})
            # Set dedicated fields for VIX and 10Y
            if name == "VIX":
                data["market_summary"]["vix"] = price
            if name == "10Y Yield":
                data["market_summary"]["ten_year_yield"] = round(price, 3)
    except: pass

data["market_summary"]["indices"] = indices

# FX from yfinance
try:
    fx = yf.Ticker("USDCAD=X").history(period="5d")
    if not fx.empty:
        cad = safe_float(fx["Close"].iloc[-1])
        data["market_summary"]["fx_rates"] = [{"pair": "USD/CAD", "price": cad}]
except: pass

# Briefing narrative from pipeline cache
pipeline = load_json(CACHE / "pipeline_output.json")
synthesis_path = CACHE / "pipeline_synthesis.txt"
if synthesis_path.exists():
    text = synthesis_path.read_text()[:2000]
    data["narrative"]["summary_paragraph"] = text
elif indices:
    # Auto-generate a market snapshot
    sp = next((i for i in indices if i["ticker"] == "S&P 500"), None)
    dj = next((i for i in indices if i["ticker"] == "Dow Jones"), None)
    ns = next((i for i in indices if i["ticker"] == "NASDAQ"), None)
    tsx = next((i for i in indices if i["ticker"] == "TSX"), None)
    v = data["market_summary"].get("vix")
    y = data["market_summary"].get("ten_year_yield")
    lines = [f"📊 **Market Snapshot**"]
    if sp: lines.append(f"  • S&P 500: {sp['price']:,.2f} ({sp['change_pct']:+.2f}%)")
    if dj: lines.append(f"  • Dow Jones: {dj['price']:,.2f} ({dj['change_pct']:+.2f}%)")
    if ns: lines.append(f"  • NASDAQ: {ns['price']:,.2f} ({ns['change_pct']:+.2f}%)")
    if tsx: lines.append(f"  • TSX: {tsx['price']:,.2f} ({tsx['change_pct']:+.2f}%)")
    if v: lines.append(f"  • VIX: {v}")
    if y: lines.append(f"  • 10Y Yield: {y}%")
    text = "\n".join(lines)
    data["narrative"]["summary_paragraph"] = text

# Premarket scan
scan = load_json(MARKET_INTEL / "premarket_scan.json")
if scan:
    data["premarket_top_setups"] = scan.get("top_setups", [])[:7]
    data["watchlist_summary"] = {
        "total_scanned": scan.get("total_scanned", 0),
        "avg_change": scan.get("avg_change", 0),
        "green_count": scan.get("green_count", 0),
        "red_count": scan.get("red_count", 0),
    }

# Global / geopolitical news. The cache is only trusted while it is fresh:
# fetch_global_news.py is not scheduled in cron, so global_news.json went stale
# on 2026-06-05 and — because the RSS fallback below only fired on an *empty*
# list — the dashboard served the same eight June headlines for seven weeks.
# Ageing the cache out lets the fallback take over on its own, with no new cron
# entry to keep alive.
GLOBAL_NEWS_MAX_AGE_H = 24
news = load_json(MARKET_INTEL / "global_news.json")
if news:
    try:
        age_h = (now - datetime.datetime.fromisoformat(news.get("_fetched_at", ""))).total_seconds() / 3600
    except (ValueError, TypeError):
        age_h = float("inf")
    if age_h > GLOBAL_NEWS_MAX_AGE_H:
        print(f"  WARN: global_news.json is {age_h:.0f}h old — ignoring it, using live RSS")
        news = None
if news:
    # Accept both key spellings. fetch_global_news.py writes link/pubdate/
    # summary; the NewsAPI-shaped payload this was first written against used
    # url/publishedAt/description. Reading only the latter blanked every link
    # and date even when the cache was fresh, which is why each headline fell
    # back to a Google News search link.
    data["geopolitical"] = [{
        "title": a.get("title", ""),
        "source": a.get("source", ""),
        "url": a.get("url") or a.get("link", ""),
        "date": to_iso(a.get("publishedAt") or a.get("pubdate", "")),
        "summary": a.get("description") or a.get("summary", ""),
    } for a in (news.get("articles", []) + news.get("headlines", []))[:8]]

# Fallback: fetch geopolitical news from RSS if global_news.json missing/stale
if not data["geopolitical"]:
    try:
        import urllib.request, xml.etree.ElementTree as ET, re as _re
        geo_feeds = [
            ("https://feeds.bbci.co.uk/news/world/rss.xml", "BBC World"),
            ("https://rss.nytimes.com/services/xml/rss/nyt/World.xml", "NY Times"),
            ("https://feeds.reuters.com/reuters/topNews", "Reuters"),
        ]
        geo_articles = []
        for feed_url, source_name in geo_feeds:
            try:
                req = urllib.request.Request(feed_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    xml_data = resp.read().decode("utf-8", errors="replace")
                root = ET.fromstring(xml_data)
                for item in root.findall(".//item")[:6]:
                    title_el = item.find("title")
                    link_el = item.find("link")
                    desc_el = item.find("description")
                    date_el = item.find("pubDate")
                    title = title_el.text.strip() if title_el is not None and title_el.text else ""
                    if not title or len(title) < 10:
                        continue
                    url_val = ""
                    if link_el is not None:
                        url_val = (link_el.text or link_el.get("href", "") or "").strip()
                    desc = desc_el.text.strip() if desc_el is not None and desc_el.text else ""
                    # Strip HTML tags from description
                    desc = _re.sub(r"<[^>]+>", "", desc)[:300]
                    # Carry the feed's own publication date through — it is the
                    # only honest freshness signal the dashboard can show, and
                    # dropping it is what left the card with no way to reveal
                    # that it had gone stale.
                    pub = to_iso(date_el.text if date_el is not None else "")
                    geo_articles.append({"title": title, "source": source_name, "url": url_val, "date": pub, "summary": desc})
            except Exception:
                pass
        # Deduplicate by title
        seen = set()
        unique = []
        for a in geo_articles:
            if a["title"] not in seen:
                seen.add(a["title"])
                unique.append(a)
        data["geopolitical"] = unique[:10]
        if data["geopolitical"]:
            print(f"  Fetched {len(data['geopolitical'])} geopolitical headlines from RSS")
    except Exception as e:
        print(f"  WARN: Geopolitical RSS fallback failed: {e}")

# Insider trades
insider = load_json(MARKET_INTEL / "insider_trades.json")
if insider:
    data["insider_trades"] = insider.get("recent_trades", [])[:10]

# Congress trades
congress = load_json(MARKET_INTEL / "congress_trades.json")
if congress:
    data["congress"] = {"recent_trades": congress.get("trades", [])[:10], "summary": congress.get("summary", "")}

# Central banks
cb_text = CACHE / "central_banks.json"
cb = load_json(cb_text)
DEFAULT_FED = (
    "The Federal Reserve held rates steady at 4.25-4.50% at its June meeting. "
    "Chair Powell noted inflation remains elevated but the labor market is cooling. "
    "Markets are pricing in one rate cut by September."
)
DEFAULT_BOC = (
    "The Bank of Canada held its overnight rate at 3.25% in June. "
    "Governor Macklem highlighted that while core inflation is trending toward "
    "the 2% target, shelter costs remain sticky."
)
if cb:
    fed_text = cb.get("fed", "").strip()
    boc_text = cb.get("boc", "").strip()
    data["central_banks"] = {
        "fed": fed_text if fed_text else DEFAULT_FED,
        "boc": boc_text if boc_text else DEFAULT_BOC,
    }
else:
    data["central_banks"] = {"fed": DEFAULT_FED, "boc": DEFAULT_BOC}

# Fallback: populate news from analysis.json (generated earlier in pipeline)
ANALYSIS = DASHBOARD_REPO / "data" / "analysis.json"
analysis = load_json(ANALYSIS)
if analysis:
    # Market news headlines from analysis top_headlines
    top = (analysis.get("market_overview") or {}).get("top_headlines", [])
    if top and not data["market_news"]["headlines"]:
        # Frontend expects objects with {title, url, source}; convert plain strings
        data["market_news"]["headlines"] = [
            t if isinstance(t, dict) else {"title": t, "url": "", "source": ""}
            for t in top
        ]
    # Geopolitical from analysis
    geo = analysis.get("geopolitical", [])
    if geo and not data["geopolitical"]:
        data["geopolitical"] = geo

# Write
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with open(OUTPUT, "w") as f:
    json.dump(data, f, indent=2)

print(f"✅ latest.json generated: {len(indices)} indices, {data['narrative'].get('summary_paragraph','')[:50]}...")
