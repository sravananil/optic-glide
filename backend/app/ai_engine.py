import os
import json
from dotenv import load_dotenv
import google.generativeai as genai
from typing import Dict
import asyncio
from functools import partial

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY not found in .env file!")

genai.configure(api_key=api_key)

SYSTEM_INSTRUCTION_GENERAL = """
You are OpticGlide AI - a predictive educational visualization assistant.
Listen to natural teaching and predict what visuals would help.

Respond ONLY with valid JSON (no markdown, no backticks):
{
    "concept": "Main topic",
    "confidence": 85,
    "type": "image",
    "color": "blue",
    "search_query": "Precise search term",
    "parts": ["Key element 1", "Key element 2"],
    "description": "1-2 sentence plain English summary of the concept",
    "key_facts": ["Short fact 1", "Short fact 2", "Short fact 3"],
    "links": [],
    "content_weight": "medium",
    "action": "expand"
}

content_weight rules:
- "short"  → user made a brief passing mention, transitional statement
- "medium" → user is actively explaining this topic (DEFAULT)
- "long"   → user is doing a deep dive, dwelling on this topic

Examples:
- Input: "Today we'll learn about freedom fighters"
  Output: {"concept": "Freedom Fighters", "confidence": 90, "type": "image", "color": "blue", "search_query": "Indian freedom fighters Gandhi Nehru", "parts": ["Mahatma Gandhi", "Jawaharlal Nehru", "Subhas Chandra Bose"], "description": "Freedom fighters are individuals who fought against colonial rule to gain independence for their nation.", "key_facts": ["Gandhi led non-violent resistance", "India gained independence in 1947", "Over 500 leaders participated"], "links": [], "content_weight": "medium", "action": "expand"}

- Input: "Let's discuss the human brain"
  Output: {"concept": "Human Brain", "confidence": 95, "type": "image", "color": "blue", "search_query": "human brain anatomy labeled", "parts": ["Frontal Lobe", "Cerebellum", "Brain Stem"], "description": "The human brain controls all body functions and is divided into 3 main regions.", "key_facts": ["Weighs approximately 1.4kg", "Contains 100 billion neurons", "Uses 20% of body energy"], "links": [], "content_weight": "medium", "action": "expand"}
"""

SYSTEM_INSTRUCTION_DOCTOR = """
You are OpticGlide Medical AI - specialized in medical education.
ONLY respond to medical/anatomical topics.

Respond ONLY with valid JSON (no markdown):
{
    "concept": "Anatomical structure",
    "confidence": 90,
    "type": "image",
    "color": "blue",
    "search_query": "Medical search term",
    "parts": ["Part 1", "Part 2"],
    "description": "1-2 sentence medical description of the structure",
    "key_facts": ["Medical fact 1", "Medical fact 2", "Medical fact 3"],
    "links": [],
    "content_weight": "medium",
    "action": "expand"
}

For non-medical topics: {"concept": "Non-medical", "confidence": 0}
"""

class AIEngine:
    def __init__(self, room_type: str = "general"):
        self.room_type = room_type
        self.conversation_context = []
        self.current_topic = None
        
        instruction = (
            SYSTEM_INSTRUCTION_DOCTOR if room_type == "doctor" 
            else SYSTEM_INSTRUCTION_GENERAL
        )
        
        self.model = genai.GenerativeModel(
            model_name='gemini-2.0-flash-exp',
            system_instruction=instruction,
            generation_config={
                "temperature": 0.7,
                "top_p": 0.95,
                "max_output_tokens": 1024,
            }
        )
        
        print(f"✅ AI Engine initialized for {room_type} room")
    
    def add_context(self, text: str):
        """Add to conversation context"""
        self.conversation_context.append(text)
        if len(self.conversation_context) > 5:
            self.conversation_context.pop(0)
    
    def get_context_string(self) -> str:
        """Get formatted context"""
        if not self.conversation_context:
            return "Starting new topic."
        return "Previous: " + " → ".join(self.conversation_context)
    
    async def predict_visuals(self, text: str) -> Dict:
        """
        Use Gemini to predict what visuals are needed from text
        """
        try:
            context = self.get_context_string()
            prompt = f"""
{context}

User said: "{text}"

Predict what visual would help explain this.
Return JSON only (no markdown).
"""
            
            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                self.model.generate_content,
                prompt
            )
            
            result_text = response.text.strip()
            
            # Clean markdown if present
            if result_text.startswith('```'):
                lines = result_text.split('\n')
                result_text = '\n'.join(lines[1:-1]) if len(lines) > 2 else result_text
                result_text = result_text.replace('```json', '').replace('```', '').strip()
            
            result = json.loads(result_text)
            
            print(f"🤖 Prediction: {result.get('concept')} ({result.get('confidence')}%)")
            
            # Add to context if confident
            if result.get("confidence", 0) > 60:
                self.add_context(result.get("concept", ""))
                self.current_topic = result.get("concept")
            
            return result
            
        except json.JSONDecodeError as e:
            print(f"❌ JSON Error: {e}")
            print(f"Raw: {result_text[:200]}")
            return {
                "concept": "Error",
                "confidence": 0,
                "type": "text",
                "color": "cyan",
                "parts": []
            }
        except Exception as e:
            print(f"❌ AI Error: {e}")
            return {
                "concept": "Error",
                "confidence": 0,
                "type": "text",
                "color": "cyan",
                "parts": []
            }

async def get_gemini_session(room_type: str = "general"):
    """Create AI engine instance"""
    engine = AIEngine(room_type)
    return engine