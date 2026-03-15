# backend/app/local_image_db.py
# Local image database — scans backend/images/doctor/ folders
# Provides fallback images when Apify fails

import os
import random
from pathlib import Path
from typing import Optional, List, Dict

# Local image folder structure
IMAGES_ROOT = Path(__file__).parent.parent / "images" / "doctor"
ANATOMY_FOLDER = IMAGES_ROOT / "anatomy"
BODY_PARTS_FOLDER = IMAGES_ROOT / "Body Parts"

# Keyword mapping — matches user topics to local folders/files
TOPIC_TO_FOLDER: Dict[str, str] = {
    # Brain & nervous system
    "brain": "anatomy",
    "human brain": "anatomy",
    "brain stem": "anatomy",
    "cerebellum": "anatomy",
    "nervous system": "anatomy",
    "neuron": "anatomy",
    "spinal cord": "anatomy",
    # Heart & circulation
    "heart": "anatomy",
    "human heart": "anatomy",
    # Respiratory
    "lungs": "anatomy",
    "lung": "anatomy",
    "respiratory": "anatomy",
    # Internal organs
    "liver": "anatomy",
    "kidney": "anatomy",
    # Skeletal system
    "skeleton": "anatomy",
    "human skeleton": "anatomy",
    "skull": "anatomy",
    "bone": "anatomy",
    # Body parts (specific)
    "ear": "body parts",
    "eye": "body parts",
    "nose": "body parts",
    "mouth": "body parts",
    "hand": "body parts",
    "foot": "body parts",
    "elbow": "body parts",
    "knee": "body parts",
    "shoulder": "body parts",
    "neck": "body parts",
    "arm": "body parts",
    "leg": "body parts",
}


def scan_local_images() -> Dict[str, List[str]]:
    """
    Scan backend/images/doctor/ and return available images.
    Returns: {"anatomy": ["brain.avif", ...], "body parts": [...]}
    """
    db = {}
    
    # Scan anatomy folder
    if ANATOMY_FOLDER.exists():
        anatomy_images = [f.name for f in ANATOMY_FOLDER.glob("*") if f.is_file()]
        db["anatomy"] = anatomy_images
        print(f"✅ Anatomy folder: {len(anatomy_images)} images")
    
    # Scan body parts folder
    if BODY_PARTS_FOLDER.exists():
        body_images = []
        # Scan subfolders (Ear/, Eye/, Nose/, etc.)
        for subfolder in BODY_PARTS_FOLDER.iterdir():
            if subfolder.is_dir():
                images = [f.name for f in subfolder.glob("*") if f.is_file()]
                body_images.extend([(subfolder.name, img) for img in images])
        db["body parts"] = body_images
        print(f"✅ Body Parts folder: {len(body_images)} images across subfolders")
    
    return db


def find_local_image(concept: str, category: str = "anatomy") -> Optional[str]:
    """
    Find a local image matching the concept.
    Returns file path relative to backend (e.g., "images/doctor/anatomy/brain.avif")
    Smart matching: tries full concept first, then keywords.
    """
    concept_lower = concept.lower().strip()
    
    # Determine folder based on category or topic keywords
    folder = TOPIC_TO_FOLDER.get(concept_lower, category)
    
    print(f"🔍 Local search: '{concept}' → {folder}")
    
    # Search in anatomy folder
    if folder == "anatomy":
        if ANATOMY_FOLDER.exists():
            # Stage 1: Try full concept match (e.g., "human brain" → "Human brain.png")
            exact_matches = []
            for file in ANATOMY_FOLDER.glob("*"):
                if file.is_file():
                    fname = file.name.lower()
                    # Check if ALL words in concept appear in filename
                    if all(word in fname for word in concept_lower.split()):
                        exact_matches.append(file)
                        print(f"  ✓ Exact match: {file.name}")
            
            if exact_matches:
                chosen = random.choice(exact_matches)
                rel_path = f"images/doctor/anatomy/{chosen.name}"
                print(f"✅ Local image found (exact): {rel_path}")
                return f"/images/doctor/anatomy/{chosen.name}"
            
            # Stage 2: Try primary keyword (e.g., "brain" in "human brain")
            primary_keyword = concept_lower.split()[-1]  # Last word is usually most specific
            keyword_matches = []
            for file in ANATOMY_FOLDER.glob("*"):
                if file.is_file() and primary_keyword in file.name.lower():
                    keyword_matches.append(file)
                    print(f"  ✓ Keyword match: {file.name}")
            
            if keyword_matches:
                chosen = random.choice(keyword_matches)
                rel_path = f"images/doctor/anatomy/{chosen.name}"
                print(f"✅ Local image found (keyword): {rel_path}")
                return f"/images/doctor/anatomy/{chosen.name}"
            
            # Stage 3: Pick random from any file (fallback)
            all_files = [f for f in ANATOMY_FOLDER.glob("*") if f.is_file()]
            if all_files:
                chosen = random.choice(all_files)
                rel_path = f"images/doctor/anatomy/{chosen.name}"
                print(f"✅ Local image found (random): {rel_path}")
                return f"/images/doctor/anatomy/{chosen.name}"
    
    # Search in body parts folder
    elif folder == "body parts":
        if BODY_PARTS_FOLDER.exists():
            # Look for subfolder matching concept (e.g., "nose" → "Nose/")
            concept_keywords = concept_lower.split()
            primary_keyword = concept_keywords[-1]  # Last word is usually most specific
            
            for subfolder in BODY_PARTS_FOLDER.iterdir():
                if subfolder.is_dir() and primary_keyword in subfolder.name.lower():
                    images = [f for f in subfolder.glob("*") if f.is_file()]
                    if images:
                        chosen = random.choice(images)
                        rel_path = f"images/doctor/Body Parts/{subfolder.name}/{chosen.name}"
                        print(f"✅ Local image found (body part): {rel_path}")
                        return f"/images/doctor/Body Parts/{subfolder.name}/{chosen.name}"
            
            # If no match, pick random from any body part
            all_images = []
            for subfolder in BODY_PARTS_FOLDER.iterdir():
                if subfolder.is_dir():
                    for file in subfolder.glob("*"):
                        if file.is_file():
                            all_images.append((subfolder.name, file.name))
            
            if all_images:
                subfolder_name, filename = random.choice(all_images)
                rel_path = f"images/doctor/Body Parts/{subfolder_name}/{filename}"
                print(f"✅ Local image found (random body part): {rel_path}")
                return f"/images/doctor/Body Parts/{subfolder_name}/{filename}"
    
    print(f"⚠️  No local image for '{concept}' in {folder}")
    return None


def get_local_image_url(concept: str, category: str = "anatomy") -> Optional[str]:
    """
    Get local image URL (returns full URL for frontend <img src>)
    This constructs the URL to serve via FastAPI.
    The URL format depends on which server is running:
    - If main.py (port 8000): http://localhost:8000/images/...
    - If main_rag.py (port 8001): http://localhost:8001/images/...
    We assume main_rag is running when this is called (from brain_rag.py).
    """
    local_path = find_local_image(concept, category)
    if local_path:
        # Return relative path that frontend can use
        # The frontend WebSocket connection (port 8001) will have /images mounted
        return local_path
    return None


# Test function
if __name__ == "__main__":
    print("📂 Scanning local image database...")
    db = scan_local_images()
    print(f"\n📊 Database: {db}")
    print(f"\n🧪 Testing...")
    print(f"Brain image: {get_local_image_url('Human Brain', 'anatomy')}")
    print(f"Nose image: {get_local_image_url('Nose', 'body parts')}")
