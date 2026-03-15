# backend/app/apify_service.py
# OpticGlide Apify Integration
# Handles: image URL fetching + Wikipedia content scraping
# Used by: brain_rag.py for pre-fetch and live fallback

import os
import json
import asyncio
import aiohttp
from pathlib import Path
from typing import Dict, List, Optional
from dotenv import load_dotenv

# Import local fallbacks
from app.local_image_db import get_local_image_url
from app.datawarehouse_loader import get_topic_for_concept

load_dotenv()

APIFY_TOKEN = os.getenv("APIFY_TOKEN")

# ─────────────────────────────────────────────────────
# CONTENT DB PATH
# Saved once by pre-fetch, read instantly at runtime
# ─────────────────────────────────────────────────────
CONTENT_DB_PATH = Path("app/content_db.json")


def load_content_db() -> Dict:
    """Load pre-fetched content database from disk"""
    if CONTENT_DB_PATH.exists():
        with open(CONTENT_DB_PATH, "r") as f:
            data = json.load(f)
        print(f"✅ content_db.json loaded — {len(data)} topics cached")
        return data
    print("⚠️  content_db.json not found — run pre-fetch first")
    return {}


def save_content_db(db: Dict):
    """Save updated content database to disk"""
    CONTENT_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CONTENT_DB_PATH, "w") as f:
        json.dump(db, f, indent=2)
    print(f"✅ content_db.json saved — {len(db)} topics")


# ─────────────────────────────────────────────────────
# APIFY — FETCH IMAGE URL (Google Images Scraper)
# Returns a direct image URL string, not a download
# ─────────────────────────────────────────────────────
# Local-only image fetcher (Apify removed)
def fetch_image_url(concept: str, category: str = "anatomy") -> str:
    """
    Always use local image database. Randomly pick a valid image from the correct folder.
    Never use external scraping.
    """
    return get_local_image_url(concept, category)


# ─────────────────────────────────────────────────────
# LIVE FALLBACK — for unknown topics during session
# Only called when concept not in content_db.json
# ─────────────────────────────────────────────────────
# Local-only fallback for unknown topics
def live_fetch_unknown(concept: str) -> Dict:
    """
    Called during a live session when concept not in content_db.
    Uses only local image and datawarehouse.
    """
    print(f"⚠️  Live fetch for unknown topic: '{concept}' (local-only)")
    image_url = fetch_image_url(concept)
    topic_data = get_topic_for_concept(concept)
    return {
        "concept": concept,
        "image_url": image_url,
        "topic_data": topic_data,
    }
