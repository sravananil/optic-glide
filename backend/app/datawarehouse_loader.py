# backend/app/datawarehouse_loader.py
# Loads anatomydata.txt (normal) for educational content
# brain_rag.py also calls get_deep_topic() for anatomydatadeep.txt

import json
from pathlib import Path
from typing import Dict, Optional

DATAWAREHOUSE_PATH      = Path(__file__).parent.parent / "datawarehouse" / "anatomydata.txt"
DEEP_DATAWAREHOUSE_PATH = Path(__file__).parent.parent / "datawarehouse" / "anatomydatadeep.txt"


def load_datawarehouse(deep: bool = False) -> Dict:
    """
    Load the datawarehouse file.
    deep=True  → anatomydatadeep.txt
    deep=False → anatomydata.txt (default)
    Returns: {"human brain": {...}, "nervous system": {...}, ...}
    """
    path = DEEP_DATAWAREHOUSE_PATH if deep else DATAWAREHOUSE_PATH
    if not path.exists():
        print(f"⚠️  Datawarehouse not found: {path}")
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        label = "deep" if deep else "normal"
        print(f"✅ Datawarehouse loaded ({label}) — {len(data)} topics")
        return data
    except Exception as e:
        print(f"❌ Datawarehouse load error: {e}")
        return {}


def search_topic(concept: str, dw: Dict = None, deep: bool = False) -> Optional[Dict]:
    """
    Search datawarehouse for a concept.
    Uses exact match first, then fuzzy word match.
    """
    if dw is None:
        dw = load_datawarehouse(deep=deep)
    if not dw:
        return None

    concept_lower = concept.lower().strip()

    # Stage 1: Exact match
    if concept_lower in dw:
        print(f"✅ Exact match: '{concept_lower}'")
        return dw[concept_lower]

    # Stage 2: Multi-word key — all words must match
    for key, value in dw.items():
        key_lower = key.lower().strip()
        key_words = key_lower.split()
        if len(key_words) > 1:
            if all(word in concept_lower for word in key_words):
                print(f"✅ Fuzzy match (multi-word): '{key}' for '{concept}'")
                return value
        else:
            if key_lower in concept_lower:
                print(f"✅ Fuzzy match (single): '{key}' for '{concept}'")
                return value

    print(f"⚠️  No match in datawarehouse for '{concept}'")
    return None


def extract_topic_from_usertext(user_text: str, dw: Dict = None) -> Optional[Dict]:
    """
    Given user speech, find the most relevant topic.
    Scores by word length — longer matches are more specific.
    """
    if dw is None:
        dw = load_datawarehouse()

    user_lower  = user_text.lower()
    best_match  = None
    best_score  = 0

    for key in dw.keys():
        for word in key.lower().split():
            if word in user_lower and len(word) > best_score:
                best_score = len(word)
                best_match = key

    if best_match:
        print(f"✅ Topic extracted: '{best_match}'")
        return dw[best_match]

    print(f"⚠️  No topic in speech: '{user_text}'")
    return None


def get_topic_for_concept(concept: str, deep: bool = False) -> Optional[Dict]:
    """
    Main function — load datawarehouse and search for concept.
    deep=True uses anatomydatadeep.txt
    """
    dw = load_datawarehouse(deep=deep)
    return search_topic(concept, dw, deep=deep)