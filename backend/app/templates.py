# backend/app/templates.py
# Fixed label templates - Your solution to position accuracy!

TEMPLATES = {
    # ========== DOCTOR ROOM ==========
    "brain": {
        "labels": [
            {"id": 1, "name": "Frontal Lobe", "x": 30, "y": 22, "color": "#FF6B6B"},
            {"id": 2, "name": "Cerebellum", "x": 55, "y": 78, "color": "#4ECDC4"},
            {"id": 3, "name": "Brain Stem", "x": 68, "y": 82, "color": "#FFE66D"}
        ],
        "alternates": [
            # Position 1 can show these names when user clicks arrow
            ["Frontal Lobe", "Parietal Lobe", "Occipital Lobe"],
            ["Cerebellum", "Temporal Lobe", "Medulla"],
            ["Brain Stem", "Spinal Cord", "Corpus Callosum"]
        ]
    },
    
    "heart": {
        "labels": [
            {"id": 1, "name": "Right Atrium", "x": 62, "y": 28, "color": "#E74C3C"},
            {"id": 2, "name": "Left Ventricle", "x": 38, "y": 68, "color": "#3498DB"},
            {"id": 3, "name": "Aorta", "x": 48, "y": 12, "color": "#2ECC71"}
        ],
        "alternates": [
            ["Right Atrium", "Superior Vena Cava", "Right Ventricle"],
            ["Left Ventricle", "Left Atrium", "Mitral Valve"],
            ["Aorta", "Pulmonary Artery", "Aortic Valve"]
        ]
    },
    
    "lungs": {
        "labels": [
            {"id": 1, "name": "Trachea", "x": 50, "y": 15, "color": "#9B59B6"},
            {"id": 2, "name": "Left Lung", "x": 35, "y": 50, "color": "#3498DB"},
            {"id": 3, "name": "Right Lung", "x": 65, "y": 50, "color": "#E74C3C"}
        ],
        "alternates": [
            ["Trachea", "Larynx", "Bronchi"],
            ["Left Lung", "Left Bronchus", "Upper Lobe"],
            ["Right Lung", "Right Bronchus", "Lower Lobe"]
        ]
    },
    
    # ========== GENERAL ROOM - ANIMALS ==========
    "cat": {
        "labels": [
            {"id": 1, "name": "Ears", "x": 35, "y": 18, "color": "#9B59B6"},
            {"id": 2, "name": "Nose", "x": 48, "y": 45, "color": "#E74C3C"},
            {"id": 3, "name": "Paws", "x": 45, "y": 85, "color": "#2ECC71"}
        ],
        "alternates": [
            ["Ears", "Eyes", "Head"],
            ["Nose", "Mouth", "Whiskers"],
            ["Paws", "Legs", "Tail"]
        ]
    },
    
    "dog": {
        "labels": [
            {"id": 1, "name": "Head", "x": 30, "y": 25, "color": "#E67E22"},
            {"id": 2, "name": "Body", "x": 60, "y": 50, "color": "#16A085"},
            {"id": 3, "name": "Tail", "x": 85, "y": 55, "color": "#8E44AD"}
        ],
        "alternates": [
            ["Head", "Ears", "Snout"],
            ["Body", "Back", "Chest"],
            ["Tail", "Legs", "Paws"]
        ]
    },
    
    # ========== GENERAL ROOM - BIRDS ==========
    "eagle": {
        "labels": [
            {"id": 1, "name": "Beak", "x": 40, "y": 30, "color": "#F39C12"},
            {"id": 2, "name": "Wings", "x": 70, "y": 50, "color": "#2980B9"},
            {"id": 3, "name": "Talons", "x": 45, "y": 85, "color": "#27AE60"}
        ],
        "alternates": [
            ["Beak", "Eyes", "Head"],
            ["Wings", "Feathers", "Body"],
            ["Talons", "Legs", "Tail"]
        ]
    },
    
    # ========== GENERAL ROOM - TECHNOLOGY ==========
    "smartphone": {
        "labels": [
            {"id": 1, "name": "Screen", "x": 50, "y": 45, "color": "#3498DB"},
            {"id": 2, "name": "Camera", "x": 50, "y": 12, "color": "#E74C3C"},
            {"id": 3, "name": "Buttons", "x": 85, "y": 40, "color": "#F39C12"}
        ],
        "alternates": [
            ["Screen", "Display", "Glass"],
            ["Camera", "Lens", "Flash"],
            ["Buttons", "Ports", "Speaker"]
        ]
    },
    
    # ========== GENERAL ROOM - FASHION ==========
    "tshirt": {
        "labels": [
            {"id": 1, "name": "Collar", "x": 50, "y": 15, "color": "#E74C3C"},
            {"id": 2, "name": "Sleeves", "x": 75, "y": 35, "color": "#3498DB"},
            {"id": 3, "name": "Hem", "x": 50, "y": 85, "color": "#2ECC71"}
        ],
        "alternates": [
            ["Collar", "Neckline", "Tag"],
            ["Sleeves", "Cuffs", "Shoulders"],
            ["Hem", "Waist", "Seams"]
        ]
    }
}

def get_template(template_name: str):
    """Get template by name, return None if not found"""
    return TEMPLATES.get(template_name.lower())

def get_all_templates():
    """Return list of all available template names"""
    return list(TEMPLATES.keys())