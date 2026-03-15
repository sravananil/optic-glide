#!/usr/bin/env python3
"""
Test script for OpticGlide - simulates user saying "show me human brain"
"""

import asyncio
import websockets
import json
import time

async def test_opticglide():
    """Test the complete OpticGlide flow"""
    
    print("🧪 OpticGlide Testing Started\n")
    print("=" * 60)
    
    try:
        # Connect to WebSocket
        uri = "ws://localhost:8000/ws"
        print(f"📡 Connecting to {uri}...")
        
        async with websockets.connect(uri) as websocket:
            print("✅ Connected!\n")
            
            # Wait for connection confirmation
            msg = await websocket.recv()
            print(f"📨 Server: {msg}\n")
            
            # Send "show me human brain" command
            user_input = "show me human brain"
            print(f"👤 User: \"{user_input}\"")
            
            await websocket.send(json.dumps({
                "type": "text",
                "text": user_input,
                "timestamp": time.time()
            }))
            
            print("⏳ Waiting for AI response...\n")
            
            # Receive response
            response = await websocket.recv()
            data = json.loads(response)
            
            print("=" * 60)
            print(f"📊 Response Type: {data.get('type')}")
            print(f"🧠 Concept: {data.get('concept')}")
            print(f"📸 Media URL: {data.get('media_url')}")
            print(f"🎯 Confidence: {data.get('confidence')}%")
            print(f"🏷️  Has Template: {'template' in data and data['template'] is not None}")
            
            if data.get('template'):
                print(f"\n📋 Template Labels:")
                for label in data['template'].get('labels', []):
                    print(f"   - {label['name']} ({label['color']}) at ({label['x']}%, {label['y']}%)")
            
            print("\n" + "=" * 60)
            print("✅ Test Complete!")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_opticglide())
