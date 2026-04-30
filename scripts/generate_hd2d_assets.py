import os
import requests
import json
import time
import base64
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# SPORT V3.0 Mobile HD-2D Aesthetic (Strict adherence to design_tokens.json)
# Primary: #00D1FF (Cyan)
# Secondary: #B066FF (Purple)
# Accent: #00FF94 (Success), #FF4B4B (Error)
# Background: #0B0E14 (Dark)
HD2D_STYLE_BASE = (
    "Masterpiece high-fidelity HD-2D game asset, pixel-perfect 1px crisp black outlines. "
    "Aesthetic: Fusion of Octopath Traveler (cinematic lighting, soft bloom) and Metal Slug (chunky bold shapes). "
    "Color Palette: Vibrant Cyan (#00D1FF) and Electric Purple (#B066FF) on Deep Dark (#0B0E14). "
    "Theme: Modern professional sports (running and cycling), no maritime or underwater elements. "
    "Technical: 32-bit color, high contrast, isolated on white background."
)

def generate_with_google(prompt_desc, output_path):
    if not GOOGLE_API_KEY:
        print("Error: GOOGLE_API_KEY not found.")
        return

    filepath = Path(output_path)
    filepath.parent.mkdir(parents=True, exist_ok=True)

    print(f"Generating: {filepath.name}...")
    full_prompt = f"{HD2D_STYLE_BASE} {prompt_desc}"

    url = f"https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key={GOOGLE_API_KEY}"
    
    headers = {"Content-Type": "application/json"}
    payload = {
        "instances": [{"prompt": full_prompt}],
        "parameters": {
            "sampleCount": 1,
            "aspectRatio": "1:1"
        }
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=120)
        response.raise_for_status()
        
        data = response.json()
        if 'predictions' in data and len(data['predictions']) > 0:
            img_b64 = data['predictions'][0]['bytesBase64Encoded']
            with open(filepath, 'wb') as handler:
                handler.write(base64.b64decode(img_b64))
            print(f"✅ Saved to {filepath}")
        else:
            print(f"❌ Error: Missing predictions in response for {filepath.name}")
    except Exception as e:
        print(f"❌ Failed: {e}")

if __name__ == "__main__":
    assets_to_generate = [
        # --- Main App Branding ---
        ("Modern minimalist sports app icon, stylized aerodynamic runner and cyclist silhouettes, vibrant cyan (#00D1FF) and purple (#B066FF) neon accents on dark background", "mobile/assets/icon.png"),
        ("Android adaptive icon foreground, minimalist runner silhouette, vibrant cyan (#00D1FF), transparent background", "mobile/assets/adaptive-icon.png"),
        ("Cinematic splash screen icon, HD-2D logo with soft bloom, dark background (#0B0E14), glowing cyan and purple energy trails", "mobile/assets/splash-icon.png"),
        ("Minimalist 48x48 favicon, pixel art runner head, vibrant cyan", "mobile/assets/favicon.png"),
        
        # --- Sprites ---
        ("High-fidelity HD-2D runner character, dynamic sprinting pose, side view, chunky proportions, high-tech gear with cyan and purple accents", "mobile/assets/generated/runner_sprite.png"),
        ("High-fidelity HD-2D road cyclist, racing bike pose, detailed helmet, vibrant purple and cyan jersey, 1px black outline", "mobile/assets/generated/cyclist_sprite.png"),
        ("High-fidelity HD-2D ghost runner, semi-transparent ethereal cyan glow, translucent trail", "mobile/assets/generated/ghost_sprite.png"),
        ("High-fidelity HD-2D elite athlete, metallic silver and gold gear with glowing cyan eyes, champion stance", "mobile/assets/generated/elite_sprite.png"),
        
        # --- HUD ---
        ("HUD heart rate icon, glowing red digital pixel heart, matrix energy, chunky game UI", "mobile/assets/generated/hud_heart.png"),
        ("HUD GPS icon, satellite silhouette with glowing cyan waves, high-tech sports telemetry", "mobile/assets/generated/hud_gps.png"),
        ("HUD battery icon, pixelated energy cell, cyan and purple gradient", "mobile/assets/generated/hud_battery.png"),
        
        # --- Navigation ---
        ("Navigation icon Home: pixel art sports stadium, HD-2D style, cyan accents", "mobile/assets/generated/nav_home.png"),
        ("Navigation icon History: pixel art digital stopwatch, purple accents, HD-2D", "mobile/assets/generated/nav_history.png"),
        ("Navigation icon Ranking: pixel art podium with glowing trophy, HD-2D", "mobile/assets/generated/nav_ranking.png"),
        ("Navigation icon Rewards: pixel art treasure chest with cyan gems, HD-2D", "mobile/assets/generated/nav_rewards.png"),
        ("Navigation icon Profile: pixel art athlete avatar silhouette, HD-2D", "mobile/assets/generated/nav_profile.png")
    ]

    print("🚀 Starting HD-2D Asset Generation for SPORT Mobile...")
    for prompt, path in assets_to_generate:
        generate_with_google(prompt, path)
        time.sleep(1)
    print("\n✨ Generation complete.")
