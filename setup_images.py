#!/usr/bin/env python3
"""Setup sample images for OpticGlide testing"""

import os
import urllib.request
from pathlib import Path

# Create directories
Path("images/doctor/anatomy").mkdir(parents=True, exist_ok=True)
Path("images/general/animals").mkdir(parents=True, exist_ok=True)
Path("images/general/birds").mkdir(parents=True, exist_ok=True)
Path("images/general/fashion").mkdir(parents=True, exist_ok=True)
Path("images/general/technology").mkdir(parents=True, exist_ok=True)

print("📁 Created image directories")

# Sample images to download (using Wikimedia Commons or placeholder service)
images = {
    "images/doctor/anatomy/brain.jpg": "https://via.placeholder.com/600x400/1a1a1a/00FFFF?text=Human+Brain",
    "images/doctor/anatomy/heart.jpg": "https://via.placeholder.com/600x400/1a1a1a/FF6B6B?text=Human+Heart",
    "images/doctor/anatomy/lungs.jpg": "https://via.placeholder.com/600x400/1a1a1a/4ECDC4?text=Lungs",
    "images/general/animals/cat.jpg": "https://via.placeholder.com/600x400/1a1a1a/9B59B6?text=Cat",
    "images/general/animals/dog.jpg": "https://via.placeholder.com/600x400/1a1a1a/E67E22?text=Dog",
    "images/general/birds/eagle.jpg": "https://via.placeholder.com/600x400/1a1a1a/F39C12?text=Eagle",
    "images/general/technology/smartphone.jpg": "https://via.placeholder.com/600x400/1a1a1a/3498DB?text=Smartphone",
    "images/general/fashion/tshirt.jpg": "https://via.placeholder.com/600x400/1a1a1a/E74C3C?text=T-Shirt",
}

for path, url in images.items():
    if not os.path.exists(path):
        try:
            print(f"📥 Downloading {path}...")
            urllib.request.urlretrieve(url, path)
            print(f"✅ Downloaded {path}")
        except Exception as e:
            print(f"❌ Failed to download {path}: {e}")
    else:
        print(f"⏭️  Already exists: {path}")

print("✅ Image setup complete!")
