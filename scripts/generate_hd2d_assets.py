import os
import requests
import json
import time
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
OUTPUT_DIR = Path("assets/generated")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# HD-2D Expert Aesthetic Prompt Template
# Combining the tilt-shift lighting of Octopath, the industrial sprite detail of Metal Slug, 
# and the clean, vibrant maritime aesthetic of Dave the Diver.
HD2D_STYLE_BASE = (
    "Masterpiece high-fidelity HD-2D sprite, pixel-perfect 1px crisp black outlines. "
    "Aesthetic: A fusion of Octopath Traveler (soft bloom, dynamic lighting), "
    "Metal Slug (hand-drawn industrial detail, chunky bold shapes), "
    "and Dave the Diver (clean vibrant maritime colors). "
    "Technical: Professional game asset, 32-bit color depth, hand-placed pixels, "
    "no blurry gradients, high contrast, isolated on a pure white background for transparency mask. "
)

def generate_with_openai(prompt_desc, filename, size="1024x1024"):
    """Generates a raster image using OpenAI's DALL-E 3 API."""
    if not OPENAI_API_KEY:
        print("Error: OPENAI_API_KEY not found.")
        return
    
    filepath = OUTPUT_DIR / filename
    if filepath.exists():
        print(f"Skipping {filename} (already exists).")
        return

    print(f"Generating (OpenAI): {filename}...")
    full_prompt = f"{HD2D_STYLE_BASE} {prompt_desc}"
    
    headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
    payload = {"model": "dall-e-3", "prompt": full_prompt, "n": 1, "size": size, "quality": "hd"}
    
    try:
        response = requests.post("https://api.openai.com/v1/images/generations", headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        image_url = response.json()['data'][0]['url']
        save_image(image_url, filename)
    except Exception as e:
        print(f"OpenAI Failed: {e}")

def generate_with_google(prompt_desc, filename):
    """
    Generates a raster image using Google's Imagen API (via Gemini API / AI Studio).
    """
    if not GOOGLE_API_KEY:
        print("Error: GOOGLE_API_KEY not found.")
        return

    filepath = OUTPUT_DIR / filename
    if filepath.exists():
        print(f"Skipping {filename} (already exists).")
        return

    print(f"Generating (Google Imagen): {filename}...")
    full_prompt = f"{HD2D_STYLE_BASE} {prompt_desc}"

    # Standard Gemini API / AI Studio endpoint for Imagen 4.0
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
        response = requests.post(url, headers=headers, json=payload, timeout=90)
        response.raise_for_status()
        
        # Google returns base64 data usually
        data = response.json()
        if 'predictions' in data and len(data['predictions']) > 0:
            import base64
            img_b64 = data['predictions'][0]['bytesBase64Encoded']
            with open(filepath, 'wb') as handler:
                handler.write(base64.b64decode(img_b64))
            print(f"Successfully saved to {filepath}")
        else:
            print(f"Google Response missing predictions: {data}")
    except Exception as e:
        print(f"Google Imagen Failed: {e}")
    
def save_image(url, filename):
    img_data = requests.get(url).content
    filepath = OUTPUT_DIR / filename
    with open(filepath, 'wb') as handler:
        handler.write(img_data)
    print(f"Successfully saved to {filepath}")

if __name__ == "__main__":
    # Comprehensive UI Spriting for Mobile App (V3.0) - Refined Expert Prompts
    mobile_assets = [
        ("A rustic tavern-style house icon, wood and stone texture, UI navigation", "nav_home.png"),
        ("A brass steampunk stopwatch, detailed gears, history log icon", "nav_history.png"),
        ("A golden laurel wreath atop a stone podium, leaderboard icon", "nav_ranking.png"),
        ("A wooden treasure chest with glowing blue light inside, reward icon", "nav_rewards.png"),
        ("A heroic pilot avatar silhouette in a circular metal frame, profile icon", "nav_profile.png"),
        ("An EKG heartbeat line glowing with cyan matrix energy, activity icon", "icon_activity.png"),
        ("A mechanical metal arrow pointing sharply upward, industrial style, trending icon", "icon_trending.png"),
        ("A node-network map icon with glowing connectors, share icon", "icon_share.png"),
        ("A heavy iron crown with inset glowing rubies, crown icon", "icon_crown.png"),
        ("Two crossed heavy broadswords, battle-worn steel, battle icon", "icon_swords.png"),
        ("A heavy hexagonal titanium shield with blue energy core, shield icon", "icon_shield.png"),
        ("A jagged electric yellow lightning bolt, high energy, zap icon", "icon_zap.png"),
        ("A glowing neon map pin with a small radar pulse at the base, location icon", "icon_mappin.png"),
        ("A stylized digital matrix cube symbol, QR code representation", "icon_qrcode.png"),
        ("A red glowing mechanical targeting reticle, crosshair icon", "icon_crosshair.png"),
        ("An industrial airlock door opening with an exit arrow, logout icon", "icon_logout.png"),
        ("A rusty metal waste bin with chemical hazard symbol, trash icon", "icon_trash.png"),
        ("A glowing green plus sign made of digital pixel blocks, add icon", "icon_plus.png")
    ]

    if GOOGLE_API_KEY:
        print("Starting Batch Generation (Google Imagen)...")
        for prompt, filename in mobile_assets:
            generate_with_google(prompt, filename)
            time.sleep(5) # Avoid rate limits
    elif OPENAI_API_KEY:
        print("Starting Batch Generation (OpenAI DALL-E 3)...")
        for prompt, filename in mobile_assets:
            generate_with_openai(prompt, filename)
            time.sleep(5)
    else:
        print("Error: No API keys found. Please set GOOGLE_API_KEY or OPENAI_API_KEY in .env")
    
    print("\nGeneration task complete. Files saved to assets/generated/")
