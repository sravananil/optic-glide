#!/usr/bin/env python3
"""Debug image finding"""

from pathlib import Path
from app.brain import ImageDatabase

db = ImageDatabase()

# Try to find "brain"
result = db.find("brain", "anatomy", "doctor")
print(f"Looking for 'brain' in doctor/anatomy:")
print(f"Result: {result}")

# Check what's actually in the folders
print(f"\nDOCTOR ANATOMY images:")
print(db.doctor["anatomy"])

print(f"\nGENERAL ANIMALS images:")
print(db.general["animals"])
