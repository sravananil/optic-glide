# backend/app/brain.py
# OpticGlide Brain - Uses CodeLlama with few-shot prompting

import requests
import json
from pathlib import Path
from typing import Dict, List, Optional
from app.templates import get_template, TEMPLATES


# ============================================================
# IMAGE DATABASE - Your folder organization solution!
# ============================================================

class ImageDatabase:
    def __init__(self):
        """
        Your solution: Organize images by category folders
        - doctor/anatomy/
        - doctor/medical/
        - general/animals/
        - general/birds/
        - general/fashion/
        - general/technology/
        """
        print("📂 Scanning image folders...")
        
        # Doctor room images
        self.doctor = {
            "anatomy": self._scan("images/doctor/anatomy"),
            "medical": self._scan("images/doctor/medical")
        }
        
        # General room images
        self.general = {
            "animals": self._scan("images/general/animals"),
            "birds": self._scan("images/general/birds"),
            "fashion": self._scan("images/general/fashion"),
            "technology": self._scan("images/general/technology")
        }
        
        # Count totals
        doctor_total = sum(len(imgs) for imgs in self.doctor.values())
        general_total = sum(len(imgs) for imgs in self.general.values())
        
        print(f"✅ Found {doctor_total} doctor images, {general_total} general images")

    def _scan(self, folder: str) -> Dict[str, str]:
        """Scan folder and return {filename: path} mapping"""
        path = Path(folder)
        path.mkdir(parents=True, exist_ok=True)
        
        print(f"📂 Scanning: {path.resolve()}")
        
        images = {}
        for ext in ["*.jpg", "*.jpeg", "*.png", "*.webp"]:
            for img in path.glob(ext):
                # Key = filename without extension (lowercase)
                key = img.stem.lower().replace("_", " ").replace("-", " ")
                images[key] = f"{folder}/{img.name}"
                print(f"  ✅ Found: {key} -> {images[key]}")
        
        if not images:
            print(f"  ⚠️ No images in {folder}")
        
        return images

    def find(self, image_name: str, category: str, room: str) -> Optional[str]:
        """
        Find image using your folder organization
        Args:
            image_name: "brain", "cat", "smartphone"
            category: "anatomy", "animals", "technology"
            room: "doctor" or "general"
        """
        name = image_name.lower().strip()
        print(f"🔍 Finding: name='{name}', category='{category}', room='{room}'")
        
        # Doctor room - search in doctor folders
        if room == "doctor":
            print(f"  📂 Searching doctor: {self.doctor}")
            for subcategory, images in self.doctor.items():
                print(f"    - {subcategory}: {list(images.keys())}")
                if name in images:
                    result = images[name]
                    print(f"  ✅ Found in doctor/{subcategory}: {result}")
                    return result
        
        # General room - search in specified category first
        else:
            print(f"  📂 Searching general category: {category}")
            if category in self.general:
                print(f"    Images: {list(self.general[category].keys())}")
                if name in self.general[category]:
                    result = self.general[category][name]
                    print(f"  ✅ Found in general/{category}: {result}")
                    return result
            
            # Fallback: search all general categories
            print(f"  📂 Fallback: searching all categories")
            for cat_name, cat_images in self.general.items():
                print(f"    - {cat_name}: {list(cat_images.keys())}")
                if name in cat_images:
                    result = cat_images[name]
                    print(f"  ✅ Found in general/{cat_name}: {result}")
                    return result
        
        # Not found
        print(f"  ❌ Image '{name}' not found")
        return None


# ============================================================
# CODELLAMA BRAIN - With Few-Shot Learning
# ============================================================

class CodeLlamaBrain:
    def __init__(self):
        self.model = "mistral:latest"
        self.url = "http://localhost:11434/api/generate"
        self.memory: List[str] = []  # Remember last 5 topics
        
        # Test connection
        self._check_ollama()

    def _check_ollama(self):
        """Check if Ollama is running"""
        try:
            r = requests.get("http://localhost:11434/api/tags", timeout=3)
            models = [m["name"] for m in r.json().get("models", [])]
            
            if self.model in models:
                print(f"✅ {self.model} ready")
            else:
                print(f"⚠️  {self.model} not found. Run: ollama pull codellama")
        except:
            print("❌ Ollama not running! Start with: ollama serve")

    def _few_shot_prompt(self, user_text: str, room: str) -> str:
        """
        Build prompt with 5 examples to teach CodeLlama.
        This is how we 'train' it without actual training!
        """
        
        # Context from memory
        context = ""
        if self.memory:
            context = f"Previous: {' → '.join(self.memory[-3:])}"
        
        # Room-specific instructions
        room_rule = ""
        if room == "doctor":
            room_rule = "DOCTOR ROOM: Only medical/anatomy topics get high confidence. Others = 0."
        
        # The key: Show 5 perfect examples with new fields
        prompt = f"""You are OpticGlideAI. Convert speech to JSON for educational images.

{room_rule}
{context}

# EXAMPLES TO LEARN FROM:

Example 1:
User: "show me the human brain"
JSON: {{"concept":"Human Brain","confidence":95,"category":"anatomy","image":"brain","parts":["Frontal Lobe","Cerebellum","Brain Stem"],"description":"The human brain controls all body functions and is divided into 3 main regions.","key_facts":["Weighs approximately 1.4kg","Contains 100 billion neurons","Uses 20% of body energy"],"links":[],"content_weight":"medium"}}

Example 2:
User: "let's see a cat"
JSON: {{"concept":"Cat","confidence":88,"category":"animals","image":"cat","parts":["Head","Body","Tail"],"description":"Cats are flexible carnivorous mammals known for their independence and agility.","key_facts":["Have 18 toe pads","Can rotate ears 180 degrees","Sleep 12-16 hours daily"],"links":[],"content_weight":"short"}}

Example 3:
User: "I want a smartphone"
JSON: {{"concept":"Smartphone","confidence":90,"category":"technology","image":"smartphone","parts":["Screen","Processor","Battery"],"description":"A smartphone is a portable device combining computing power and communication capabilities.","key_facts":["First smartphone: IBM Simon (1992)","Over 6 billion users worldwide","Runs iOS or Android"],"links":[],"content_weight":"medium"}}

Example 4:
User: "show me an eagle"
JSON: {{"concept":"Eagle","confidence":85,"category":"birds","image":"eagle","parts":["Wings","Talons","Beak"],"description":"Eagles are large raptors known for their incredible vision and hunting prowess.","key_facts":["Can see 4x farther than humans","Dive at speeds over 200 mph","Live 20-50 years in wild"],"links":[],"content_weight":"short"}}

Example 5:
User: "display the heart"
JSON: {{"concept":"Heart","confidence":92,"category":"anatomy","image":"heart","parts":["Right Atrium","Left Ventricle","Aorta"],"description":"The heart is a muscular organ that pumps blood throughout the circulatory system.","key_facts":["Beats 100,000 times per day","Pumps 2000 gallons daily","Has 4 chambers"],"links":[],"content_weight":"medium"}}

# RULES:
- confidence: 80-100 clear, 50-79 okay, 0-49 unclear/wrong room
- category: anatomy, animals, birds, fashion, technology
- image: exact filename (lowercase, no extension)
- parts: array of component names (3-4 items)
- description: 1-2 sentence plain English explanation
- key_facts: array of 3 short factual statements
- links: empty array [] for now
- content_weight: "short" (brief mention), "medium" (dedicated explanation), "long" (deep dive)

# YOUR TURN (JSON only):
User: "{user_text}"
JSON:"""

        return prompt

    def think(self, user_text: str, room: str) -> Dict:
        """Send to CodeLlama and get structured response"""
        
        prompt = self._few_shot_prompt(user_text, room)
        
        try:
            response = requests.post(
                self.url,
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.1,  # Very consistent
                        "num_predict": 120
                    }
                },
                timeout=15
            )
            
            if response.status_code != 200:
                return self._fallback(user_text)
            
            raw = response.json().get("response", "").strip()
            
            # Extract JSON between { and }
            start = raw.find("{")
            end = raw.rfind("}") + 1
            
            if start == -1 or end <= start:
                print(f"⚠️ No JSON in response")
                return self._fallback(user_text)
            
            result = json.loads(raw[start:end])
            
            # Remember if confident
            if result.get("confidence", 0) > 60:
                self.memory.append(result.get("concept", ""))
                if len(self.memory) > 5:
                    self.memory.pop(0)
            
            print(f"🤖 {result.get('concept')} ({result.get('confidence')}%)")
            return result
            
        except Exception as e:
            print(f"❌ Error: {e}")
            return self._fallback(user_text)

    def _fallback(self, text: str) -> Dict:
        """Fallback keyword-based responses with all required fields"""
        keywords = {
            "brain": ("Human Brain", "anatomy", "brain", 80, "The brain controls all body functions.", ["Weighs 1.4kg", "100 billion neurons", "Uses 20% body energy"]),
            "heart": ("Human Heart", "anatomy", "heart", 80, "The heart pumps blood through the circulatory system.", ["Beats 100k times/day", "4 chambers", "Pumps 5L/min"]),
            "lung":  ("Lungs", "anatomy", "lungs", 75, "Lungs exchange oxygen and carbon dioxide.", ["2 lungs total", "300 million alveoli", "12-20 breaths/min"]),
            "cat":   ("Cat", "animals", "cat", 75, "Cats are domesticated carnivorous mammals.", ["350+ breeds", "Can rotate ears 180°", "Sleep 12-16 hrs/day"]),
            "dog":   ("Dog", "animals", "dog", 75, "Dogs are loyal domesticated mammals.", ["300+ breeds", "Descended from wolves", "Lifespan 10-15 yrs"]),
            "eagle": ("Eagle", "birds", "eagle", 75, "Eagles are large birds of prey with sharp vision.", ["Can see 8x farther than humans", "Wingspan up to 2.5m", "Mate for life"]),
            "phone": ("Smartphone", "technology", "smartphone", 70, "Smartphones are pocket computers with cellular connectivity.", ["Billions sold yearly", "Runs apps and OS", "Camera + sensors"]),
            "shirt": ("T-Shirt", "fashion", "tshirt", 70, "T-shirts are casual cotton garments worn worldwide.", ["Most worn garment", "First worn 1898", "Cotton or synthetic"]),
            "laptop": ("Laptop", "technology", "laptop", 75, "Laptops are portable personal computers.", ["Battery powered", "Foldable screen", "Keyboard + trackpad"]),
        }

        text_lower = text.lower()
        for kw, (concept, cat, img, conf, desc, facts) in keywords.items():
            if kw in text_lower:
                self.memory.append(concept)
                return {
                    "concept": concept,
                    "confidence": conf,
                    "category": cat,
                    "image": img,
                    "template": img,
                    "parts": [],
                    "description": desc,
                    "key_facts": facts,
                    "links": [],
                    "content_weight": "medium",
                }

        return {
            "concept": "Unknown",
            "confidence": 0,
            "category": "",
            "image": "",
            "template": None,
            "parts": [],
            "description": "",
            "key_facts": [],
            "links": [],
            "content_weight": "short",
        }
# ============================================================
# MAIN BRAIN - Puts everything together
# ============================================================

class OpticGlideBrain:
    def __init__(self):
        print("\n🧠 OpticGlide Brain Starting...")
        self.ai = CodeLlamaBrain()
        self.images = ImageDatabase()
        print("✅ Brain Ready!\n")

    def process(self, user_text: str, room: str = "general") -> Dict:
        """
        Complete pipeline:
        1. CodeLlama predicts concept
        2. Normalize for Gemini/CodeLlama mismatch
        3. Find image in organized folders
        4. Load fixed template for labels
        5. Return everything
        """
        
        # Step 1: AI prediction
        prediction = self.ai.think(user_text, room)
        print(f"🤖 Prediction: {prediction}")
        
        # Step 2: Check confidence
        if prediction.get("confidence", 0) < 50:
            return {
                "type": "low_confidence",
                "confidence": prediction.get("confidence", 0)
            }
        
        # Step 2.5: Normalize for Gemini/CodeLlama mismatch
        # CodeLlama outputs: "image": "brain"
        # Gemini outputs: "search_query": "human brain"
        image_key = prediction.get("image") or prediction.get("search_query", "").lower().replace(" ", "")
        
        if not image_key:
            # Fallback: extract from concept
            concept_lower = prediction.get("concept", "").lower()
            image_key = concept_lower.split()[0]  # First word
        
        category = prediction.get("category", "")
        
        # Infer category from concept if missing
        if not category:
            concept_lower = prediction.get("concept", "").lower()
            if any(word in concept_lower for word in ["brain", "heart", "lung", "skull", "skeleton"]):
                category = "anatomy"
            elif any(word in concept_lower for word in ["cat", "dog", "bird"]):
                category = "animals"
            elif "eagle" in concept_lower:
                category = "birds"
            elif any(word in concept_lower for word in ["phone", "smartphone", "tablet"]):
                category = "technology"
            elif any(word in concept_lower for word in ["shirt", "tshirt", "pant"]):
                category = "fashion"
        
        # Infer room from category if in doctor room
        inferred_room = room
        if room == "general" and category == "anatomy":
            inferred_room = "doctor"
            print(f"🏥 Inferred room: 'general' → 'doctor' (anatomy is in doctor room)")
        
        print(f"🔄 Normalized: image_key='{image_key}', category='{category}', room='{inferred_room}'")
        
        # Step 3: Find image
        image_path = self.images.find(
            image_key,
            category,
            inferred_room
        )
        
        # Step 4: Load template (your fixed labels solution!)
        # Try multiple template names
        template_name = prediction.get("template") or image_key
        template = get_template(template_name) if template_name else None

        # Step 5: Build final response
        if image_path:
            media_url = f"http://localhost:8000/{image_path}"
            print(f"✅ Image found: {image_path}")
        else:
            # Placeholder if image not found
            text = prediction.get("concept", "").replace(" ", "+")
            media_url = f"https://via.placeholder.com/600x400/111827/00FFFF?text={text}"
            print(f"⚠️ Image not found, using placeholder for: {prediction.get('concept')}")

        # Step 6: Build final response (with all fields)
        result = {
            "type": "visualization",
            "concept": prediction["concept"],
            "media_url": media_url,
            "confidence": prediction["confidence"],
            "template": template if template else None,
            "parts": prediction.get("parts", []),
            "description": prediction.get("description", f"Educational content about {prediction['concept']}."),
            "key_facts": prediction.get("key_facts", []),
            "links": prediction.get("links", []),
            "content_weight": prediction.get("content_weight", "medium"),
        }

        return result 