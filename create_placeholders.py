#!/usr/bin/env python3
"""Create placeholder images using PIL"""

from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

# Create directories if they don't exist
images_dir = {
    "images/doctor/anatomy": ["brain.jpg", "heart.jpg", "lungs.jpg"],
    "images/general/animals": ["cat.jpg", "dog.jpg"],
    "images/general/birds": ["eagle.jpg"],
    "images/general/fashion": ["tshirt.jpg"],
    "images/general/technology": ["smartphone.jpg"],
}

for directory, files in images_dir.items():
    Path(directory).mkdir(parents=True, exist_ok=True)
    
    for filename in files:
        filepath = Path(directory) / filename
        
        if filepath.exists():
            print(f"⏭️  Already exists: {filepath}")
            continue
        
        # Create a simple colored image with text
        img = Image.new('RGB', (600, 400), color=(26, 26, 26))
        d = ImageDraw.Draw(img)
        
        # Add text
        text = filename.split('.')[0].upper().replace('_', ' ')
        try:
            # Try to use a default font
            d.text((300, 200), text, fill=(0, 255, 255), anchor="mm", font=None)
        except:
            d.text((300, 200), text, fill=(0, 255, 255), anchor="mm")
        
        # Save
        img.save(filepath)
        print(f"✅ Created {filepath}")

print("✅ All placeholder images created!")
