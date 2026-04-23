import requests
import time
import math
import random

# Traccar OsmAnd protocol URL
# Format: http://host:port/?id=deviceid&lat=lat&lon=lon&timestamp=time&hdop=hdop&altitude=alt&speed=speed
TRACCAR_URL = "http://localhost:5055/"

# Warsaw Center
START_LAT = 52.2297
START_LON = 21.0122

DEVICE_ID = "athlete_001"

def simulate_runner():
    print(f"🚀 Starting Traccar Simulator for device: {DEVICE_ID}")
    print(f"📍 Target: {TRACCAR_URL}")
    
    current_lat = START_LAT
    current_lon = START_LON
    
    # Simulate a path (walking in a circle/trail)
    angle = 0
    
    while True:
        # Move approx 5-10 meters (speed around 10-15 km/h)
        speed_kmh = 12 + random.uniform(-2, 2)
        speed_ms = speed_kmh / 3.6
        
        # Simple circular movement for demo
        angle += 0.05
        current_lat += math.sin(angle) * 0.0005
        current_lon += math.cos(angle) * 0.0005
        
        params = {
            "id": DEVICE_ID,
            "lat": current_lat,
            "lon": current_lon,
            "timestamp": int(time.time()),
            "hdop": 1.0,
            "altitude": 100,
            "speed": speed_ms / 0.514444 # Convert m/s to knots for Traccar
        }
        
        try:
            response = requests.get(TRACCAR_URL, params=params, timeout=5)
            if response.status_code == 200:
                print(f"✅ Sent: {current_lat:.5f}, {current_lon:.5f} | Speed: {speed_kmh:.1f} km/h")
            else:
                print(f"❌ Error {response.status_code}: {response.text}")
        except Exception as e:
            print(f"⚠️ Connection error: {e}")
            
        time.sleep(2) # Send every 2 seconds

if __name__ == "__main__":
    simulate_runner()
