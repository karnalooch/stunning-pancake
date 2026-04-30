from PIL import Image, ImageDraw
from pathlib import Path

# Colors from design_tokens.json
COLORS = {
    "primary": "#00D1FF",
    "secondary": "#B066FF",
    "gold": "#D4A373",
    "orange": "#FF6B35",
    "deep_sea": "#0B1D33",
    "black": "#000000",
    "white": "#FFFFFF",
    "success": "#00FF94"
}

def create_pixel_image(size, draw_func, output_path):
    # We draw at a smaller scale and then resize (nearest neighbor) to get that pixel art look
    scale = 8
    small_size = (size[0] // scale, size[1] // scale)
    if small_size[0] == 0: small_size = (16, 16) # Fallback for very small images
    
    img = Image.new("RGBA", small_size, (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    
    draw_func(draw, small_size)
    
    # Scale up to final size
    final_img = img.resize(size, Image.Resampling.NEAREST)
    
    # Ensure directory exists
    filepath = Path(output_path)
    filepath.parent.mkdir(parents=True, exist_ok=True)
    
    final_img.save(filepath)
    print(f"Saved: {output_path}")

def draw_runner(draw, size):
    w, h = size
    # Head
    draw.rectangle([w//2-1, 2, w//2+1, 4], fill=COLORS["primary"], outline=COLORS["black"])
    # Body
    draw.line([w//2, 4, w//2, h-6], fill=COLORS["black"], width=1)
    # Arms (dynamic)
    draw.line([w//2, 6, w//2-3, 4], fill=COLORS["black"], width=1)
    draw.line([w//2, 6, w//2+3, 8], fill=COLORS["black"], width=1)
    # Legs (running)
    draw.line([w//2, h-6, w//2-3, h-2], fill=COLORS["black"], width=1)
    draw.line([w//2, h-6, w//2+3, h-4], fill=COLORS["black"], width=1)

def draw_cyclist(draw, size):
    w, h = size
    # Wheels
    draw.ellipse([2, h-6, 6, h-2], outline=COLORS["black"])
    draw.ellipse([w-6, h-6, w-2, h-2], outline=COLORS["black"])
    # Frame
    draw.line([4, h-4, w-4, h-4], fill=COLORS["black"])
    draw.line([4, h-4, w//2, 6], fill=COLORS["black"])
    draw.line([w-4, h-4, w//2, 6], fill=COLORS["black"])
    # Rider
    draw.rectangle([w//2-1, 2, w//2+1, 4], fill=COLORS["orange"], outline=COLORS["black"])

def draw_ghost(draw, size):
    w, h = size
    # Ghost body
    draw.chord([2, 2, w-2, h-2], 180, 360, fill=COLORS["secondary"], outline=COLORS["black"])
    draw.rectangle([2, h//2, w-2, h-4], fill=COLORS["secondary"])
    # Bottom wiggly
    for i in range(2, w-2, 2):
        draw.pieslice([i, h-6, i+2, h-2], 0, 180, fill=COLORS["secondary"], outline=COLORS["black"])

def draw_heart(draw, size):
    w, h = size
    # Heart shape
    draw.polygon([(w//2, h-2), (2, h//2), (w//4, 2), (w//2, h//3), (3*w//4, 2), (w-2, h//2)], fill="#FF4B4B", outline=COLORS["black"])

def draw_gps(draw, size):
    w, h = size
    # Satellite/Pin
    draw.ellipse([w//2-3, 2, w//2+3, 8], fill=COLORS["primary"], outline=COLORS["black"])
    draw.polygon([(w//2-3, 6), (w//2+3, 6), (w//2, h-2)], fill=COLORS["primary"], outline=COLORS["black"])

def draw_trophy(draw, size):
    w, h = size
    # Cup
    draw.polygon([(4, 2), (w-4, 2), (w-6, h-6), (6, h-6)], fill=COLORS["gold"], outline=COLORS["black"])
    # Base
    draw.rectangle([w//2-3, h-6, w//2+3, h-4], fill=COLORS["black"])
    draw.rectangle([4, h-4, w-4, h-2], fill=COLORS["black"])

def draw_icon(draw, size):
    w, h = size
    # Background
    draw.rectangle([0, 0, w, h], fill=COLORS["deep_sea"])
    # Stylized 'S'
    draw.line([w//4, h//4, 3*w//4, h//4], fill=COLORS["primary"], width=2)
    draw.line([w//4, h//4, w//4, h//2], fill=COLORS["primary"], width=2)
    draw.line([w//4, h//2, 3*w//4, h//2], fill=COLORS["primary"], width=2)
    draw.line([3*w//4, h//2, 3*w//4, 3*h//4], fill=COLORS["primary"], width=2)
    draw.line([w//4, 3*h//4, 3*w//4, 3*h//4], fill=COLORS["primary"], width=2)

if __name__ == "__main__":
    # Main Icons
    create_pixel_image((1024, 1024), draw_icon, "mobile/assets/icon.png")
    create_pixel_image((1024, 1024), draw_icon, "mobile/assets/adaptive-icon.png")
    create_pixel_image((1284, 2778), draw_icon, "mobile/assets/splash-icon.png")
    create_pixel_image((48, 48), draw_icon, "mobile/assets/favicon.png")
    
    # Sprites
    create_pixel_image((130, 130), draw_runner, "mobile/assets/generated/runner_sprite.png")
    create_pixel_image((130, 130), draw_ghost, "mobile/assets/generated/ghost_sprite.png")
    create_pixel_image((130, 130), draw_cyclist, "mobile/assets/generated/cyclist_sprite.png")
    
    # HUD
    create_pixel_image((64, 64), draw_heart, "mobile/assets/generated/hud_heart.png")
    create_pixel_image((64, 64), draw_gps, "mobile/assets/generated/hud_gps.png")
    create_pixel_image((128, 128), draw_trophy, "mobile/assets/generated/reward_trophy.png")
