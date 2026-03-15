#!/usr/bin/env python3
"""Verify OpticGlide setup and image serving"""

import os
import json
from pathlib import Path

def verify_setup():
    print("🔍 OpticGlide Setup Verification\n")
    
    # Check backend dir
    backend_path = Path(__file__).parent / "backend"
    print(f"✅ Backend: {backend_path}")
    
    # Check images directory
    images_dir = Path(__file__).parent / "images" / "doctor" / "anatomy"
    print(f"\n📂 Anatomy images folder: {images_dir}")
    
    if images_dir.exists():
        images = list(images_dir.glob("*.*"))
        print(f"   Found {len(images)} images:")
        for img in images:
            print(f"   - {img.name}")
    else:
        print(f"   ❌ Missing!")
    
    # Check content_db.json
    content_db_path = backend_path / "app" / "content_db.json"
    print(f"\n📋 Content DB: {content_db_path}")
    
    if content_db_path.exists():
        try:
            with open(content_db_path) as f:
                db = json.load(f)
            print(f"   ✅ Valid JSON with {len(db)} entries")
            for key, entry in db.items():
                img_url = entry.get("image_url", "")
                print(f"   - {key}: {img_url}")
        except json.JSONDecodeError as e:
            print(f"   ❌ JSON Error: {e}")
    else:
        print(f"   ❌ Missing!")
    
    # Check main.py static file mounting
    main_py = backend_path / "app" / "main.py"
    if main_py.exists():
        with open(main_py) as f:
            content = f.read()
            if '/images' in content and 'StaticFiles' in content:
                print(f"\n✅ Static file serving configured in main.py")
            else:
                print(f"\n❌ Static file serving NOT configured")
    
    print("\n✨ Setup verification complete!")

if __name__ == "__main__":
    verify_setup()
