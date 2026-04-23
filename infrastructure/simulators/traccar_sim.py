import requests
import time
import math
import random

# Traccar API and protocol
API_URL = "http://localhost:8082/api"
PROTO_URL = "http://localhost:5055/"
AUTH = ("admin", "admin")

DEVICE_ID = "athlete_001"
DEVICE_NAME = "Maria Wisniewska (Sim)"

def setup_device():
    print(f"Checking device {DEVICE_ID} in Traccar...")
    try:
        # Check if device exists
        resp = requests.get(f"{API_URL}/devices", auth=AUTH)
        devices = resp.json()
        if any(d['uniqueId'] == DEVICE_ID for d in devices):
            print("Device already exists.")
            return
            
        # Create device
        print("Creating new device...")
        payload = {
            "name": DEVICE_NAME,
            "uniqueId": DEVICE_ID,
            "category": "person"
        }
        requests.post(f"{API_URL}/devices", json=payload, auth=AUTH)
        print("Device created.")
    except Exception as e:
        print(f"Setup error (maybe Traccar not ready): {e}")

def simulate_runner():
    setup_device()
    
    current_lat = 52.2297
    current_lon = 21.0122
    angle = 0
    
    while True:
        angle += 0.02
        current_lat += math.sin(angle) * 0.0003
        current_lon += math.cos(angle) * 0.0003
        
        params = {
            "id": DEVICE_ID,
            "lat": current_lat,
            "lon": current_lon,
            "timestamp": int(time.time()),
            "speed": (12 + random.uniform(-1, 1)) / 1.852 # ~12 km/h in knots
        }
        
        try:
            requests.get(PROTO_URL, params=params, timeout=5)
            print(f"Sent: {current_lat:.5f}, {current_lon:.5f}")
        except:
            pass
            
        time.sleep(2)

if __name__ == "__main__":
    simulate_runner()
