# backend/app/brain_rag.py
# OpticGlide RAG Brain — LOCAL ONLY (no Apify, no external images)
#
# DATA PIPELINE:
#   1. Noise filter          → block short/meaningless speech
#   2. Fast keyword match    → 0.05s for known topics
#   3. Datawarehouse lookup  → anatomydata.txt (normal) or anatomydatadeep.txt (deep)
#   4. Mistral AI            → for unknown topics
#   5. Keyword fallback      → if AI fails
#
# IMAGE PIPELINE:
#   1. Match concept → correct local folder (anatomy / body parts)
#   2. Random pick from that folder (10-15 images per folder)
#   3. Serve via http://localhost:8001/images/...
#   NEVER use external image scraping. NEVER use Apify for images.
#
# INTENT DETECTION (Content Displaying Structure):
#   "show image / display / show me"   → intent = "image_only"
#   "explain / teach / talk about"     → intent = "image_and_content"
#   "explain more / go deeper / detail"→ intent = "content_only" (no new image)
#   "explain in detail / deep / advanced" → deep=True → use anatomydatadeep.txt

import requests
import json
import random
from pathlib import Path
from typing import Dict, List, Optional

from app.templates import get_template
from app.local_image_db import get_local_image_url
from app.datawarehouse_loader import get_topic_for_concept

# ─────────────────────────────────────────────────────
# DEEP DATAWAREHOUSE PATH
# anatomydatadeep.txt — used when user asks for deep explanation
# ─────────────────────────────────────────────────────
DEEP_DATAWAREHOUSE_PATH = Path(__file__).parent.parent / "datawarehouse" / "anatomydatadeep.txt"


def get_deep_topic(concept: str) -> Optional[Dict]:
    """Load from anatomydatadeep.txt for deep explanation requests."""
    if not DEEP_DATAWAREHOUSE_PATH.exists():
        print(f"⚠️  Deep datawarehouse not found: {DEEP_DATAWAREHOUSE_PATH}")
        return None
    try:
        with open(DEEP_DATAWAREHOUSE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        concept_lower = concept.lower().strip()
        # Exact match
        if concept_lower in data:
            print(f"✅ Deep match: '{concept_lower}'")
            return data[concept_lower]
        # Fuzzy match
        for key, value in data.items():
            if concept_lower in key or key in concept_lower:
                print(f"✅ Deep fuzzy match: '{key}' for '{concept}'")
                return value
        print(f"⚠️  No deep match for '{concept}' — using normal data")
        return None
    except Exception as e:
        print(f"❌ Deep datawarehouse error: {e}")
        return None


# ─────────────────────────────────────────────────────
# NOISE WORDS — short utterances to completely ignore
# ─────────────────────────────────────────────────────
NOISE_WORDS = {
    "hmm", "um", "uh", "ok", "okay", "yes", "no", "very", "like",
    "thanks", "thank you", "mm", "ah", "oh", "so", "well", "right",
    "and", "but", "now", "here", "just", "also", "then", "next",
}

# ─────────────────────────────────────────────────────
# FAST KEYWORD MAP — instant 0.05s for known topics
# ─────────────────────────────────────────────────────
FAST_KEYWORDS: Dict[str, Dict] = {
    # Anatomy — full phrases first (checked before single words)
    "human brain":        {"concept": "Human Brain",        "category": "anatomy",    "template": "brain"},
    "human heart":        {"concept": "Human Heart",        "category": "anatomy",    "template": "heart"},
    "human skeleton":     {"concept": "Human Skeleton",     "category": "anatomy",    "template": "brain"},
    "nervous system":     {"concept": "Nervous System",     "category": "anatomy",    "template": "brain"},
    "digestive system":   {"concept": "Digestive System",   "category": "anatomy",    "template": "brain"},
    "circulatory system": {"concept": "Circulatory System", "category": "anatomy",    "template": "brain"},
    "respiratory system": {"concept": "Respiratory System", "category": "anatomy",    "template": "brain"},
    "spinal cord":        {"concept": "Spinal Cord",        "category": "anatomy",    "template": "brain"},
    # Anatomy — single words
    "brain":              {"concept": "Human Brain",        "category": "anatomy",    "template": "brain"},
    "heart":              {"concept": "Human Heart",        "category": "anatomy",    "template": "heart"},
    "lungs":              {"concept": "Lungs",              "category": "anatomy",    "template": "lungs"},
    "lung":               {"concept": "Lungs",              "category": "anatomy",    "template": "lungs"},
    "liver":              {"concept": "Liver",              "category": "anatomy",    "template": "brain"},
    "kidney":             {"concept": "Kidney",             "category": "anatomy",    "template": "brain"},
    "kidneys":            {"concept": "Kidney",             "category": "anatomy",    "template": "brain"},
    "stomach":            {"concept": "Stomach",            "category": "anatomy",    "template": "brain"},
    "skeleton":           {"concept": "Human Skeleton",     "category": "anatomy",    "template": "brain"},
    "skull":              {"concept": "Human Skull",        "category": "anatomy",    "template": "brain"},
    "spine":              {"concept": "Spine",              "category": "anatomy",    "template": "brain"},
    "neuron":             {"concept": "Neuron",             "category": "anatomy",    "template": "brain"},
    "neurons":            {"concept": "Neuron",             "category": "anatomy",    "template": "brain"},
    "muscle":             {"concept": "Muscle",             "category": "anatomy",    "template": "brain"},
    "muscles":            {"concept": "Muscle",             "category": "anatomy",    "template": "brain"},
    "blood":              {"concept": "Blood",              "category": "anatomy",    "template": "brain"},
    "bone":               {"concept": "Bone",               "category": "anatomy",    "template": "brain"},
    "bones":              {"concept": "Bone",               "category": "anatomy",    "template": "brain"},
    "ear":                {"concept": "Ear",                "category": "body parts", "template": "brain"},
    "eye":                {"concept": "Eye",                "category": "body parts", "template": "brain"},
    "nose":               {"concept": "Nose",               "category": "body parts", "template": "brain"},
    "neck":               {"concept": "Neck",               "category": "body parts", "template": "brain"},
    "hand":               {"concept": "Hand",               "category": "body parts", "template": "brain"},
    "foot":               {"concept": "Foot",               "category": "body parts", "template": "brain"},
    "arm":                {"concept": "Arm",                "category": "body parts", "template": "brain"},
    "leg":                {"concept": "Leg",                "category": "body parts", "template": "brain"},
    "elbow":              {"concept": "Elbow",              "category": "body parts", "template": "brain"},
    "knee":               {"concept": "Knee",               "category": "body parts", "template": "brain"},
    "shoulder":           {"concept": "Shoulder",           "category": "body parts", "template": "brain"},
    # Medical
    "stethoscope":        {"concept": "Stethoscope",        "category": "anatomy",    "template": "brain"},
    "dna":                {"concept": "DNA",                "category": "anatomy",    "template": "brain"},
    "cell":               {"concept": "Cell Biology",       "category": "anatomy",    "template": "brain"},
    # Animals
    "cat":                {"concept": "Cat",                "category": "animals",    "template": "cat"},
    "dog":                {"concept": "Dog",                "category": "animals",    "template": "dog"},
    "elephant":           {"concept": "Elephant",           "category": "animals",    "template": "brain"},
    "tiger":              {"concept": "Tiger",              "category": "animals",    "template": "brain"},
    "lion":               {"concept": "Lion",               "category": "animals",    "template": "brain"},
    # Birds
    "eagle":              {"concept": "Eagle",              "category": "birds",      "template": "eagle"},
    "parrot":             {"concept": "Parrot",             "category": "birds",      "template": "brain"},
    # Technology
    "laptop":             {"concept": "Laptop",             "category": "technology", "template": "brain"},
    "smartphone":         {"concept": "Smartphone",         "category": "technology", "template": "smartphone"},
    "phone":              {"concept": "Smartphone",         "category": "technology", "template": "smartphone"},
    # Fashion
    "tshirt":             {"concept": "T-Shirt",            "category": "fashion",    "template": "tshirt"},
    "t-shirt":            {"concept": "T-Shirt",            "category": "fashion",    "template": "tshirt"},
    "shirt":              {"concept": "T-Shirt",            "category": "fashion",    "template": "tshirt"},
}

# ─────────────────────────────────────────────────────
# INTENT DETECTION KEYWORDS
# ─────────────────────────────────────────────────────

# "show image" / "display" / "show me" → image only, no text
IMAGE_ONLY_TRIGGERS = [
    "show image", "show me", "display image", "show picture",
    "full screen", "fullscreen", "zoom in", "only image",
    "show diagram", "display diagram", "just image",
]

# "explain more" / "go deeper" → text only, reuse existing image
CONTENT_ONLY_TRIGGERS = [
    "explain more", "go deeper", "tell me more", "more details",
    "elaborate", "continue", "and more", "what else",
    "details please", "deeper explanation", "expand on",
]

# "explain in detail" / "deep" / "advanced" → use anatomydatadeep.txt
DEEP_TRIGGERS = [
    "in detail", "deep explanation", "explain in detail",
    "advanced", "advanced anatomy", "detailed", "thoroughly",
    "full explanation", "complete explanation",
]


class RagBrain:
    """
    Local-only brain. Images from local folders. Data from datawarehouse files.
    No Apify, no external scraping, no Wikipedia API calls.
    """

    def __init__(self):
        self.model   = "mistral:latest"
        self.url     = "http://localhost:11434/api/generate"
        self.memory: List[str] = []       # last 5 concepts for context
        self.room    = "general"
        self.paused  = False
        self.last_concept: Optional[str] = None  # for content_only mode (reuse image)

        self._check_ollama()
        print(f"✅ RagBrain ready — local images + datawarehouse only")

    def _check_ollama(self):
        try:
            r = requests.get("http://localhost:11434/api/tags", timeout=3)
            models = [m["name"] for m in r.json().get("models", [])]
            status = "✅" if self.model in models else "⚠️  not found — run: ollama pull mistral"
            print(f"  {status} {self.model}")
        except Exception:
            print("❌ Ollama not running! Run: ollama serve")

    def get_models(self) -> Dict:
        try:
            r = requests.get("http://localhost:11434/api/tags", timeout=3)
            models = [m["name"] for m in r.json().get("models", [])]
            return {"available": models, "active": self.model, "status": "ok"}
        except Exception:
            return {"available": [], "active": self.model, "status": "error"}

    def set_room(self, room: str):
        self.room = room
        print(f"🏠 Room: {room}")

    def reload_content_db(self):
        """Kept for API compatibility with main_rag.py — no-op since we use local only."""
        print("🔄 Using local datawarehouse — no content_db reload needed")

    # ─────────────────────────────────────────────
    # MAIN PROCESS — single entry point
    # ─────────────────────────────────────────────
    def process(self, user_text: str, room: str = "general") -> Dict:
        if self.paused:
            return {"type": "low_confidence", "confidence": 0}

        text_lower = user_text.lower().strip()

        # ── Layer 1: Noise filter ─────────────────
        if self._is_noise(text_lower):
            print(f"🚫 Noise: '{user_text}'")
            return {"type": "low_confidence", "confidence": 0}

        # ── Layer 2: Detect intent from speech ────
        intent = self._detect_intent(text_lower)
        is_deep = self._is_deep_request(text_lower)
        print(f"🎯 Intent: {intent} | Deep: {is_deep}")

        # ── CONTENT_ONLY: user wants more text on existing topic ──
        # Do NOT find a new image, just get more text for same concept
        if intent == "content_only" and self.last_concept:
            print(f"📖 Content-only for: {self.last_concept}")
            return self._build_content_only(self.last_concept, is_deep)

        # ── Layer 3: Fast keyword match ───────────
        fast = self._fast_keyword_match(text_lower)
        if fast:
            concept  = fast["concept"]
            category = fast["category"]
            template = fast["template"]
            print(f"⚡ Fast match: {concept}")
            return self._build_result(concept, category, template, 90, intent, is_deep)

        # ── Layer 4: Mistral AI ────────────────────
        prediction = self._ask_mistral(user_text, room)
        if prediction.get("confidence", 0) >= 50:
            concept  = prediction.get("concept", "")
            category = prediction.get("category", "anatomy")
            template = prediction.get("template", "") or concept.lower().split()[0]
            return self._build_result(concept, category, template,
                                      prediction["confidence"], intent, is_deep)

        # ── Layer 5: Keyword fallback ─────────────
        return self._keyword_fallback(text_lower, intent, is_deep)

    # ─────────────────────────────────────────────
    # INTENT DETECTION
    # ─────────────────────────────────────────────
    def _detect_intent(self, text_lower: str) -> str:
        """
        Returns:
          "image_only"       → user only wants to see the image
          "content_only"     → user wants more text, no new image
          "image_and_content"→ default — show image + description + facts
        """
        for trigger in IMAGE_ONLY_TRIGGERS:
            if trigger in text_lower:
                return "image_only"
        for trigger in CONTENT_ONLY_TRIGGERS:
            if trigger in text_lower:
                return "content_only"
        return "image_and_content"

    def _is_deep_request(self, text_lower: str) -> bool:
        """Returns True if user wants a deep explanation."""
        return any(trigger in text_lower for trigger in DEEP_TRIGGERS)

    # ─────────────────────────────────────────────
    # NOISE FILTER
    # ─────────────────────────────────────────────
    def _is_noise(self, text_lower: str) -> bool:
        if not text_lower:
            return True
        words = text_lower.split()
        if not words:
            return True
        # Single word that is a noise word or very short
        if len(words) == 1 and (words[0] in NOISE_WORDS or len(words[0]) <= 2):
            return True
        # Mostly filler
        filler_count = sum(1 for w in words if w in NOISE_WORDS)
        if len(words) <= 3 and filler_count / len(words) > 0.5:
            return True
        return False

    # ─────────────────────────────────────────────
    # FAST KEYWORD MATCH — 0.05s
    # ─────────────────────────────────────────────
    def _fast_keyword_match(self, text_lower: str) -> Optional[Dict]:
        # Sort longer keys first — prevents "brain" matching before "human brain"
        for keyword in sorted(FAST_KEYWORDS.keys(), key=len, reverse=True):
            if keyword in text_lower:
                return FAST_KEYWORDS[keyword]
        return None

    # ─────────────────────────────────────────────
    # BUILD RESULT — assembles the full response payload
    # ─────────────────────────────────────────────
    def _build_result(
        self,
        concept:    str,
        category:   str,
        template_name: str,
        confidence: int,
        intent:     str,
        is_deep:    bool,
    ) -> Dict:
        """
        Builds the final response dict.
        Images: LOCAL ONLY from backend/images/doctor/
        Data:   anatomydata.txt (normal) or anatomydatadeep.txt (deep)
        """
        self.last_concept = concept  # remember for content_only mode
        concept_key = concept.lower().strip()

        # ── Get image from LOCAL folder only ──────
        image_url = self._get_local_image(concept, category)

        # ── Get data from datawarehouse ───────────
        description = ""
        key_facts   = []
        parts       = []
        full_text   = ""
        content_weight = "medium"

        # Try deep first if requested
        dw_data = None
        if is_deep:
            dw_data = get_deep_topic(concept)
            if dw_data:
                content_weight = "long"

        # Fall back to normal datawarehouse
        if not dw_data:
            dw_data = get_topic_for_concept(concept)
            if dw_data:
                content_weight = dw_data.get("content_weight", "medium")

        if dw_data:
            description = dw_data.get("description", "")
            key_facts   = dw_data.get("key_facts", [])
            parts       = dw_data.get("parts", [])
            full_text   = dw_data.get("full_text", "")
            # If deep data has full_text, use long
            if full_text and len(full_text) > 200:
                content_weight = "long"

        # ── If still no description, generate with Mistral ──
        if not description:
            description = self._generate_description(concept, category)

        # ── Template labels ───────────────────────
        template = get_template(template_name or concept_key)
        if template and not parts:
            parts = [lbl["name"] for lbl in template.get("labels", [])]

        # ── Remember in memory ────────────────────
        if confidence >= 50:
            self.memory.append(concept)
            if len(self.memory) > 5:
                self.memory.pop(0)

        # ── Apply intent to content_weight ────────
        # image_only → short (just image, no text block)
        # content_only → handled separately in _build_content_only
        if intent == "image_only":
            content_weight = "short"

        print(f"📦 {concept} | img={'✅' if image_url and 'placeholder' not in image_url else '⚠️'} | intent={intent} | deep={is_deep} | weight={content_weight}")

        return {
            "type":           "visualization",
            "concept":        concept,
            "media_url":      image_url,
            "confidence":     confidence,
            "description":    description,
            "key_facts":      key_facts,
            "parts":          parts,
            "content_weight": content_weight,
            "full_text":      full_text,
            "links":          [],
            "template":       template,
            "intent":         intent,
            "source":         "local_datawarehouse",
        }

    # ─────────────────────────────────────────────
    # CONTENT-ONLY BUILD — for "explain more"
    # Reuses last concept's image, just gets more text
    # ─────────────────────────────────────────────
    def _build_content_only(self, concept: str, is_deep: bool) -> Dict:
        """
        Called when user says "explain more", "go deeper" etc.
        Does NOT get a new image — reuses the last one.
        Returns only expanded text content.
        """
        description = ""
        key_facts   = []
        full_text   = ""

        if is_deep:
            dw_data = get_deep_topic(concept)
            if dw_data:
                description = dw_data.get("description", "")
                key_facts   = dw_data.get("key_facts", [])
                full_text   = dw_data.get("full_text", "")

        if not description:
            dw_data = get_topic_for_concept(concept)
            if dw_data:
                description = dw_data.get("description", "")
                key_facts   = dw_data.get("key_facts", [])
                full_text   = dw_data.get("full_text", "")

        if not description:
            description = self._generate_description(concept, "anatomy")

        print(f"📖 Content-only response for '{concept}' | deep={is_deep}")

        return {
            "type":           "visualization",
            "concept":        concept,
            "media_url":      "",          # NO image — frontend must reuse last one
            "confidence":     85,
            "description":    description,
            "key_facts":      key_facts,
            "parts":          [],
            "content_weight": "long" if full_text else "medium",
            "full_text":      full_text,
            "links":          [],
            "template":       None,
            "intent":         "content_only",
            "source":         "local_datawarehouse",
        }

    # ─────────────────────────────────────────────
    # LOCAL IMAGE — from backend/images/doctor/
    # ─────────────────────────────────────────────
    def _get_local_image(self, concept: str, category: str) -> str:
        """
        Get image from local folder only.
        Returns http://localhost:8001/images/... URL.
        Never empty — always returns either a real image or a text placeholder.
        """
        # get_local_image_url returns a path like /images/doctor/anatomy/brain.png
        local_path = get_local_image_url(concept, category)
        if local_path:
            # Make it a full URL served by main_rag.py on port 8001
            if local_path.startswith("http"):
                return local_path
            # Ensure it starts with /images/
            if not local_path.startswith("/"):
                local_path = "/" + local_path
            return f"http://localhost:8001{local_path}"

        # Absolute last resort: text placeholder (no external URL)
        print(f"⚠️  No local image found for '{concept}' in category '{category}'")
        text_safe = concept.replace(" ", "+")
        return f"https://via.placeholder.com/600x400/111827/00FFFF?text={text_safe}"

    # ─────────────────────────────────────────────
    # MISTRAL AI — for unknown topics
    # ─────────────────────────────────────────────
    def _ask_mistral(self, user_text: str, room: str) -> Dict:
        context   = f"Previous: {' → '.join(self.memory[-3:])}" if self.memory else ""
        room_rule = "DOCTOR ROOM: Only anatomy/medical topics. Others → confidence 0." if room == "doctor" else ""

        prompt = f"""You are OpticGlideAI. Convert speech to JSON for educational images.

{room_rule}
{context}

Examples:
User: "show me the human brain"
JSON: {{"concept":"Human Brain","confidence":95,"category":"anatomy","template":"brain"}}

User: "let's see a cat"
JSON: {{"concept":"Cat","confidence":88,"category":"animals","template":"cat"}}

User: "explain the heart"
JSON: {{"concept":"Human Heart","confidence":92,"category":"anatomy","template":"heart"}}

RULES:
- confidence: 80-100 clear, 50-79 okay, 0-49 unclear
- category: anatomy, animals, birds, fashion, technology
- template: lowercase first word of concept
- Return ONLY valid JSON, nothing else.

User: "{user_text}"
JSON:"""

        try:
            response = requests.post(
                self.url,
                json={
                    "model":  self.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.1, "num_predict": 60},
                },
                timeout=15,
            )
            if response.status_code != 200:
                return {"confidence": 0}
            raw   = response.json().get("response", "").strip()
            start = raw.find("{")
            end   = raw.rfind("}") + 1
            if start == -1 or end <= start:
                return {"confidence": 0}
            result = json.loads(raw[start:end])
            try:
                result["confidence"] = int(result.get("confidence", 0))
            except Exception:
                result["confidence"] = 0
            print(f"🤖 Mistral: {result.get('concept')} ({result.get('confidence')}%)")
            return result
        except Exception as e:
            print(f"⚠️  Mistral error: {e}")
            return {"confidence": 0}

    # ─────────────────────────────────────────────
    # GENERATE DESCRIPTION — Mistral on-demand
    # Used only when datawarehouse has no description
    # ─────────────────────────────────────────────
    def _generate_description(self, concept: str, category: str) -> str:
        prompt = f"""Write a short educational description (1-2 sentences, max 120 characters) for '{concept}'.
Return ONLY the description text, nothing else.
Description:"""
        try:
            response = requests.post(
                self.url,
                json={
                    "model":  self.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.3, "num_predict": 50},
                },
                timeout=8,
            )
            if response.status_code == 200:
                desc = response.json().get("response", "").strip()
                if desc and len(desc) > 15:
                    print(f"✨ Generated: '{desc[:60]}...'")
                    return desc
        except Exception as e:
            print(f"⚠️  Description generation error: {e}")
        return f"Educational content about {concept}."

    # ─────────────────────────────────────────────
    # KEYWORD FALLBACK — if Mistral fails
    # ─────────────────────────────────────────────
    def _keyword_fallback(self, text_lower: str, intent: str, is_deep: bool) -> Dict:
        FALLBACK = {
            "brain":  ("Human Brain",   "anatomy",     "brain"),
            "heart":  ("Human Heart",   "anatomy",     "heart"),
            "lung":   ("Lungs",         "anatomy",     "lungs"),
            "liver":  ("Liver",         "anatomy",     "brain"),
            "kidney": ("Kidney",        "anatomy",     "brain"),
            "cat":    ("Cat",           "animals",     "cat"),
            "dog":    ("Dog",           "animals",     "dog"),
            "eagle":  ("Eagle",         "birds",       "eagle"),
            "phone":  ("Smartphone",    "technology",  "smartphone"),
            "shirt":  ("T-Shirt",       "fashion",     "tshirt"),
            "skull":  ("Human Skull",   "anatomy",     "brain"),
            "ear":    ("Ear",           "body parts",  "brain"),
            "eye":    ("Eye",           "body parts",  "brain"),
            "nose":   ("Nose",          "body parts",  "brain"),
            "neck":   ("Neck",          "body parts",  "brain"),
        }
        for kw, (concept, category, template) in FALLBACK.items():
            if kw in text_lower:
                return self._build_result(concept, category, template, 75, intent, is_deep)
        return {"type": "low_confidence", "confidence": 0}