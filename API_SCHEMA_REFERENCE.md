# OpticGlide API Schema Reference

## Backend → Frontend JSON Response Format

### Complete Response Structure

```json
{
  "concept": "Human Brain",
  "confidence": 95,
  "type": "image",
  "color": "blue",
  "search_query": "human brain anatomy labeled",
  "parts": ["Frontal Lobe", "Cerebellum", "Brain Stem"],
  "description": "The human brain controls all body functions and is divided into 3 main regions.",
  "key_facts": [
    "Weighs approximately 1.4kg",
    "Contains 100 billion neurons",
    "Uses 20% of body energy"
  ],
  "links": [],
  "content_weight": "medium",
  "action": "expand",
  "image_url": "/images/brain.jpg"
}
```

### Field Specifications

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `concept` | string | ✅ Yes | Main topic name (e.g., "Heart", "Python") |
| `confidence` | number (0-100) | ✅ Yes | How confident AI is about topic relevance |
| `type` | string | ✅ Yes | Currently always "image" |
| `color` | string | Optional | Color hint for UI (e.g., "blue", "cyan") |
| `search_query` | string | Optional | Query used to find image |
| `parts` | array[string] | ✅ Yes | Component/section names (3-4 items typical) |
| `description` | string | ✅ Yes | 1-2 sentence plain English explanation |
| `key_facts` | array[string] | ✅ Yes | 3-5 short factual bullet points |
| `links` | array[object] | ✅ Yes | External resources (currently empty) |
| `content_weight` | enum | ✅ Yes | "short" \| "medium" \| "long" |
| `action` | string | ✅ Yes | Currently always "expand" |
| `image_url` OR `image_path` | string | Optional | Path to image file |

### Content Weight Rules

**Short (Brief Mention)**
- Used when user makes passing reference
- AI confidence: 50-70%
- Renders as compact card with small image
- Example: "And that's called photosynthesis"

**Medium (Active Explanation - DEFAULT)**
- Used when user actively explaining topic
- AI confidence: 70-90%
- Renders as standard slide layout
- Most common template

**Long (Deep Dive)**
- Used when user dwelling on topic  
- AI confidence: 90%+
- Renders as image-dominant research layout
- Example: "Let me explain this in detail..."

### Frontend Processing

```typescript
// The frontend evaluates content_weight to select template:
- "short"  → ShortViewTemplate (3-4 lines width)
- "medium" → MediumViewTemplate (standard, DEFAULT)
- "long"   → LongViewTemplate (image-dominant)
```

### Example Responses by Room Type

#### General Room
```json
{
  "concept": "Golden Retriever",
  "confidence": 85,
  "parts": ["Head", "Paws", "Tail"],
  "description": "Golden Retrievers are friendly, intelligent dogs known for their golden coat.",
  "key_facts": ["Average weight: 55-75 pounds", "Originated in Scotland", "Great family pets"],
  "content_weight": "short",
  "links": [],
  "action": "expand"
}
```

#### Doctor Room
```json
{
  "concept": "Heart",
  "confidence": 92,
  "parts": ["Right Atrium", "Left Ventricle", "Aorta"],
  "description": "The heart is a muscular organ pumping blood through the circulatory system.",
  "key_facts": ["Beats 100,000 times daily", "Pumps 2000 gallons of blood", "Tennis ball sized"],
  "content_weight": "medium",
  "links": [],
  "action": "expand"
}
```

### Special Handling

**Low Confidence**
```json
{
  "concept": "Unknown Topic",
  "confidence": 20,
  "type": "text",
  "parts": [],
  "description": "I'm not sure about this topic.",
  "key_facts": [],
  "links": [],
  "content_weight": "short",
  "action": "expand"
}
```

**Non-Medical in Doctor Room**
```json
{
  "concept": "Not Medical",
  "confidence": 0
}
```

### Integration Points

1. **WebSocket Message Format:**
   ```typescript
   {
     type: 'visualization',
     ...allFieldsAbove
   }
   ```

2. **Image URLs:**
   - Frontend checks both `image_url` and `image_path`
   - Falls back to placeholder if not found
   - Supports: jpg, png, webp, avif

3. **Voice Trigger Detection:**
   - Frontend listens for: "show image", "let me see", "fullscreen"
   - Automatically enters blackboard mode
   - Shows image at natural resolution

---

**Reference Implementation Locations:**
- Frontend Type Checking: `frontend/src/types.ts`
- AI Schema Updates: `backend/app/ai_engine.py` (lines 17-50)
- CodeLlama Examples: `backend/app/brain.py` (lines 159-195)
