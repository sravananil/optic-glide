# OpticGlide Upgrade - Quick Start Guide

## ⚡ TL;DR - What Changed?

### The Big Picture
OpticGlide now displays educational content in THREE different layouts (short, medium, long) based on how detailed the user's explanation is. Previous topics shrink into colored balls that you can click to restore.

### Quick Stats
- **6 new React components** created
- **2 backend files** updated with enhanced JSON schema
- **1 type file** created for TypeScript safety
- **Zero breaking changes** - old code still works

## 🚀 Getting Started

### Frontend Setup
```bash
cd frontend
npm install  # Already have framer-motion? Good!
npm run dev
```

### Backend Setup
```bash
cd backend
# Make sure your .env has GEMINI_API_KEY
uvicorn app.main:app --reload
```

### Test It
1. Go to room (should connect automatically)
2. Click the microphone
3. Say: **"Show me the human brain"**
4. 🎉 See new template system in action!

## 📁 Where Are All The New Files?

```
✅ frontend/src/types.ts                                  (NEW)
✅ frontend/src/components/ImageDisplay.tsx              (NEW)  
✅ frontend/src/components/TemplateRenderer.tsx          (NEW)
✅ frontend/src/components/templates/ShortViewTemplate.tsx    (NEW)
✅ frontend/src/components/templates/MediumViewTemplate.tsx   (NEW)
✅ frontend/src/components/templates/LongViewTemplate.tsx     (NEW)
✅ frontend/src/components/RoomInterface.tsx             (UPDATED)
✅ backend/app/ai_engine.py                              (UPDATED)
✅ backend/app/brain.py                                  (UPDATED)
```

## 🎯 Key Concepts

### 1. ConceptNode Structure
```typescript
{
  id: "node_1234567",           // Unique ID
  concept: "Human Brain",        // Topic name
  imageUrl: "/images/brain.jpg", // Image path
  description: "...",            // 1-2 sentences
  key_facts: ["...", "..."],     // Array of facts
  content_weight: "medium",      // "short" | "medium" | "long"
  status: "active",              // "active" | "minimized"
  color: "#06B6D4",              // Cyan/purple/green/etc
  position: { x: 50, y: 50 },   // % position on canvas
  timestamp: Date(),
  mentionCount: 1                // Track mentions
}
```

### 2. Three Templates Explained

**Short** (Brief mention)
```
┌─────────────────────┐
│ [Image] Description │
│          Fact Chips │
└─────────────────────┘
```

**Medium** (Active explanation - DEFAULT)
```
┌─────────────────────┐
│      TITLE          │
│    [BIG IMAGE]      │
│   Description text  │
│   Fact 1 | Fact 2   │
│   Fact 3 | Fact 4   │
└─────────────────────┘
```

**Long** (Deep dive)
```
┌────────────────────────────┐
│ [BIG IMG] | TITLE          │
│ (left)    | Description    │
│           | Key Facts      │
│           | Components     │
│           | Resources      │
└────────────────────────────┘
```

### 3. Node Orbit System
```
        🟢 Brain (minimized)
       /
      /
     ◎ (center - active node shows here)
      \
       \
        🔴 Heart (minimized)

Click any colored ball → it becomes active
```

## 🧪 Testing Checklist

- [ ] **Voice input works** - Say "show me the human brain"
- [ ] **Image loads** - Should display if in /images/ folder
- [ ] **Template changes** - Try different content descriptions
- [ ] **Node restoration** - Click a minimized node ball
- [ ] **Blackboard mode** - Say "show image" or "fullscreen"
- [ ] **Transcript updates** - See both user and AI messages

## ⚙️ Configuration

### Backend AI Response
The AI now needs to return these fields:
```json
{
  "concept": "...",
  "description": "1-2 sentences",
  "key_facts": [3-5 items],
  "content_weight": "short|medium|long",
  "parts": [component list],
  "links": []
}
```

### Frontend Triggers
- **Blackboard mode**: "show image", "let me see", "fullscreen"
- **Default template**: When type is "medium" 
- **Node restore**: Click any colored ball in orbit

## 🎨 Customization

### Change Template Colors
Edit in RoomInterface.tsx:
```typescript
const NODE_COLORS = [
  "#06B6D4", // cyan
  "#8B5CF6", // purple  
  "#10B981", // green
  // Add more colors here
];
```

### Adjust Node Orbit Radius
In RoomInterface.tsx, `calcMinimizedPosition()`:
```typescript
const rx = 32;  // Horizontal radius (% of canvas)
const ry = 26;  // Vertical radius (% of canvas)
// Increase values = larger orbit
```

### Modify Animation Speeds
All animations use Framer Motion duration:
```typescript
transition={{ duration: 0.35 }}  // Change this value
```

## 🐛 Common Issues

### Issue: "Template not found"
**Solution:** Make sure all template files exist in `components/templates/`

### Issue: "Image won't load"
**Solution:** Check that image path is correct (`image_url` or `image_path` field)

### Issue: "Styles look wrong"
**Solution:** Make sure Tailwind CSS is properly imported

### Issue: "Animations are janky"
**Solution:** Clear browser cache, hard refresh (Ctrl+Shift+R)

## 📊 Architecture Overview

```
┌─────────────┐
│ Browser    │
│ ┌─────────┐│
│ │   App   ││  Renders templates
│ │ Central ││  Manages nodes  
│ │Component││  Listens to mic
│ └─────────┘│
└──────┬──────┘
       │ WebSocket
       │
┌──────▼──────────┐
│ FastAPI Server │
│ ┌────────────┐ │
│ │ AI Engine  │ │  Calls Gemini
│ │ (Gemini)   │ │  or CodeLlama
│ │   Brain    │ │  Returns JSON
│ └────────────┘ │
└────────────────┘
```

## 🔮 Future Ideas (Not Implemented Yet)

1. **Mention tracking** - Automatically upgrade templates on repeat mentions
2. **Predictive prefetching** - Cache upcoming topics in background
3. **Resource badges** - Show links/docs/videos in LongView
4. **Drawing mode** - Annotate images live during teaching
5. **Multiple languages** - Support non-English speech

## 📞 Support

If something doesn't work:
1. Check console for errors (F12)
2. Make sure WebSocket connects (Should see "✅ WebSocket Connected")
3. Verify backend is running and responsive
4. Check that all new files are in place

---

**Happy Teaching! 🎓**

For detailed API documentation, see `API_SCHEMA_REFERENCE.md`  
For complete implementation details, see `IMPLEMENTATION_SUMMARY.md`
