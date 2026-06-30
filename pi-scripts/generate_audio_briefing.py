#!/usr/bin/env python3
"""
generate_audio_briefing.py — Daily Audio News Squawk

Reads ~/morning-briefing/data/web-news.json (Exa web news articles, fetched
daily), builds a concise text script from the top headlines + summaries,
converts to speech via edge-tts, and saves the MP3 to the audio directory.

Output:
  ~/morning-briefing/data/audio/briefing-YYYY-MM-DD.mp3
  ~/morning-briefing/public/data/audio/briefing-YYYY-MM-DD.mp3  (synced)

Cron: 07:08 weekdays
"""

import json
import os
import subprocess
import sys
from datetime import date
from pathlib import Path

# ── Configuration ────────────────────────────────────────────────
HOME = Path.home()
DATA_DIR = HOME / "morning-briefing" / "data"
WEB_NEWS_FILE = DATA_DIR / "web-news.json"
AUDIO_DIR = DATA_DIR / "audio"
PUBLIC_AUDIO_DIR = HOME / "morning-briefing" / "public" / "data" / "audio"

TODAY = date.today()
FILENAME = f"briefing-{TODAY.isoformat()}.mp3"
OUTPUT_MP3 = AUDIO_DIR / FILENAME
PUBLIC_MP3 = PUBLIC_AUDIO_DIR / FILENAME

MAX_HEADLINES = 8
# edge-tts voice (en-US-GuyNeural is a clear, natural male US voice)
VOICE = "en-US-GuyNeural"


# ── Helpers ──────────────────────────────────────────────────────
def load_web_news(path: Path) -> list | None:
    """Load web-news.json and return the articles list, or None."""
    if not path.exists():
        print(f"[ERROR] web-news.json not found at {path}")
        return None
    try:
        with open(path, "r") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        print(f"[ERROR] Failed to parse {path}: {e}")
        return None

    articles = data if isinstance(data, list) else data.get("articles", data.get("results", []))
    if isinstance(articles, list) and len(articles) > 0:
        return articles
    print(f"[WARN] No articles found in {path}")
    return None


def build_script(articles: list, max_headlines: int = 8) -> str:
    """Build a spoken-word text script from the top headlines."""
    # Get the top N headlines that have a title
    top = [a for a in articles if a.get("title")][:max_headlines]

    if not top:
        return "No news headlines available for today."

    # Date heading
    date_str = TODAY.strftime("%A, %B %d, %Y")
    lines = [f"Top stories for {date_str}."]

    for i, article in enumerate(top, 1):
        headline = article.get("title", "").strip()
        # Get a short summary (prefer summary, fallback to description, snippet)
        summary = (
            article.get("summary")
            or article.get("description")
            or article.get("snippet")
            or ""
        ).strip()
        # Truncate summary to ~120 chars for spoken brevity
        if len(summary) > 120:
            summary = summary[:117] + "..."

        if i == 1:
            lines.append(f"First, {headline}.")
        elif i == len(top):
            lines.append(f"Finally, {headline}.")
        else:
            lines.append(f"Next, {headline}.")

        if summary:
            lines.append(summary)

    # Closing
    lines.append("That covers the top market stories for today. Stay informed and trade wisely.")
    return " ".join(lines)


def text_to_speech(text: str, output_path: Path, voice: str = VOICE) -> bool:
    """Convert text to speech using edge-tts CLI."""
    print(f"[INFO] Generating speech ({len(text)} chars) → {output_path}")
    try:
        # edge-tts CLI: edge-tts --text "..." --voice en-US-GuyNeural --write-media output.mp3
        result = subprocess.run(
            [
                "edge-tts",
                "--text", text,
                "--voice", voice,
                "--write-media", str(output_path),
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode != 0:
            print(f"[ERROR] edge-tts failed: {result.stderr.strip()}")
            return False
        file_size = output_path.stat().st_size if output_path.exists() else 0
        print(f"[OK] MP3 saved ({file_size / 1024:.1f} KB)")
        return file_size > 0
    except FileNotFoundError:
        print("[ERROR] edge-tts not installed. Run: pip install edge-tts")
        return False
    except subprocess.TimeoutExpired:
        print("[ERROR] edge-tts timed out after 120s")
        return False
    except Exception as e:
        print(f"[ERROR] edge-tts exception: {e}")
        return False


def sync_to_public(src: Path, dst: Path) -> bool:
    """Copy the MP3 to the public directory, creating parent dirs."""
    try:
        dst.parent.mkdir(parents=True, exist_ok=True)
        import shutil
        shutil.copy2(src, dst)
        print(f"[OK] Synced to {dst}")
        return True
    except Exception as e:
        print(f"[ERROR] Sync failed: {e}")
        return False


def cleanup_old_files(directory: Path, keep_days: int = 14):
    """Remove audio files older than keep_days."""
    if not directory.exists():
        return
    cutoff = date.today()
    from datetime import timedelta
    for f in sorted(directory.glob("briefing-*.mp3")):
        try:
            # Extract date from filename: briefing-YYYY-MM-DD.mp3
            fdate_str = f.stem.replace("briefing-", "")
            fdate = date.fromisoformat(fdate_str)
            if (cutoff - fdate).days > keep_days:
                f.unlink()
                print(f"[CLEANUP] Removed old: {f.name}")
        except (ValueError, OSError):
            continue


# ── Main ─────────────────────────────────────────────────────────
def main():
    print("═" * 50)
    print(f"  generate_audio_briefing.py — {TODAY.isoformat()}")
    print("═" * 50)

    # 1. Ensure output directories exist
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    # 2. Load web-news.json
    articles = load_web_news(WEB_NEWS_FILE)
    if not articles:
        print("[SKIP] No articles — nothing to generate.")
        return 1

    print(f"[DATA] Loaded {len(articles)} articles from {WEB_NEWS_FILE}")

    # 3. Build the text script
    script = build_script(articles, MAX_HEADLINES)
    print(f"[SCRIPT] Built briefing script ({len(script)} chars)")
    print("-" * 50)
    print(script[:300] + ("..." if len(script) > 300 else ""))
    print("-" * 50)

    # 4. Check if today's file already exists (skip re-generation)
    if OUTPUT_MP3.exists():
        print(f"[SKIP] {OUTPUT_MP3} already exists ({OUTPUT_MP3.stat().st_size / 1024:.1f} KB)")
        # Still ensure it's synced to public
        sync_to_public(OUTPUT_MP3, PUBLIC_MP3)
        return 0

    # 5. Convert to speech
    success = text_to_speech(script, OUTPUT_MP3)
    if not success:
        return 1

    # 6. Sync to public dir
    sync_to_public(OUTPUT_MP3, PUBLIC_MP3)

    # 7. Cleanup old files (>14 days)
    cleanup_old_files(AUDIO_DIR)
    cleanup_old_files(PUBLIC_AUDIO_DIR)

    print("[DONE] Audio briefing generated successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
