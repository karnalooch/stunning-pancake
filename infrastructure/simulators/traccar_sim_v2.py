import requests
import time
import sys

URL = "http://localhost:5055/?id=athlete_001&lat={}&lon={}"

def run():
    print("Starting simple sim...", flush=True)
    lat = 52.2297
    lon = 21.0122
    while True:
        try:
            requests.get(URL.format(lat, lon), timeout=5)
            print(f"Sent: {lat}, {lon}", flush=True)
            lat += 0.0001
            lon += 0.0001
        except Exception as e:
            print(f"Error: {e}", flush=True)
        time.sleep(2)

if __name__ == "__main__":
    run()
