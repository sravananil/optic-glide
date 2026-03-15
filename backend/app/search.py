# backend/app/search.py

import os
import aiohttp
from dotenv import load_dotenv
from typing import Optional

load_dotenv()

SERPER_API_KEY = os.getenv("SERPER_API_KEY")

async def search_images(query: str) -> Optional[str]:
    """
    Search for high-quality educational images
    """
    if not SERPER_API_KEY:
        print("⚠️ SERPER_API_KEY not set, using placeholder")
        return f"https://via.placeholder.com/600x400/1a1a1a/00FFFF?text={query.replace(' ', '+')}"
    
    url = "https://google.serper.dev/images"
    
    headers = {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json"
    }
    
    payload = {
        "q": f"{query} high quality educational diagram",
        "num": 10,
        "gl": "in"  # India
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    images = data.get("images", [])
                    
                    if images:
                        # Return first high-quality image
                        best_image = images[0].get("imageUrl")
                        print(f"🖼️ Found image: {best_image}")
                        return best_image
                    else:
                        print("⚠️ No images found")
                        return None
                else:
                    print(f"❌ Search API error: {response.status}")
                    return None
    
    except Exception as e:
        print(f"❌ Search error: {e}")
        return None