import requests
import time
import math
import random
import threading

# Configuration
TRACCAR_API = "http://localhost:8082/api"
PROTO_URL = "http://localhost:5055/"
BROUTER_URL = "http://localhost:17777/brouter"
AUTH = ("admin", "admin")

# Key locations in Siedlce to route between
HUB_POINTS = [
    (52.1685, 22.2874), # Centrum
    (52.1724, 22.2616), # Zachód
    (52.1625, 22.2830), # Południe
    (52.1695, 22.3050), # Wschód
    (52.1750, 22.2850), # Północ
]

class BRouterAthleteSimulator(threading.Thread):
    def __init__(self, device_id, name, athlete_type):
        super().__init__()
        self.device_id = device_id
        self.name = name
        self.athlete_type = athlete_type
        
        self.current_pos = random.choice(HUB_POINTS)
        self.lat, self.lon = self.current_pos
        self.path = []
        self.path_idx = 0
        
        self.speed_kmh = random.uniform(8.0, 9.5) if athlete_type == 'RUN' else random.uniform(16.0, 28.0)
        self.profile = "trekking" if athlete_type == 'RUN' else "fastbike"
        self.running = True

    def get_new_path(self):
        target = random.choice([p for p in HUB_POINTS if p != self.current_pos])
        try:
            params = {
                "lonlats": f"{self.lon},{self.lat}|{target[1]},{target[0]}",
                "profile": self.profile,
                "alternativeidx": 0,
                "format": "geojson"
            }
            resp = requests.get(BROUTER_URL, params=params, timeout=10)
            if resp.ok:
                coords = resp.json()['features'][0]['geometry']['coordinates']
                # Convert [lon, lat] to [lat, lon]
                self.path = [[c[1], c[0]] for c in coords]
                self.path_idx = 0
                print(f"OSM: {self.name} found path with {len(self.path)} nodes")
            else:
                print(f"OSM Error: BRouter returned {resp.status_code}")
                self.path = [list(self.current_pos), list(target)]
        except Exception as e:
            print(f"OSM Connection Error: {e}")
            self.path = [list(self.current_pos), list(target)]

    def setup_device(self):
        try:
            requests.post(f"{TRACCAR_API}/devices", json={
                "name": self.name, "uniqueId": self.device_id, "category": "person" if self.athlete_type == 'RUN' else 'bicycle'
            }, auth=AUTH, timeout=5)
        except: pass

    def run(self):
        self.setup_device()
        self.get_new_path()
        
        while self.running:
            if self.path_idx >= len(self.path):
                self.current_pos = (self.lat, self.lon)
                self.get_new_path()
                continue

            target_lat, target_lon = self.path[self.path_idx]
            
            # Distance math for 52'N
            m_per_lat = 111132
            m_per_lon = 111320 * math.cos(math.radians(self.lat))
            
            d_lat_m = (target_lat - self.lat) * m_per_lat
            d_lon_m = (target_lon - self.lon) * m_per_lon
            dist_m = math.sqrt(d_lat_m**2 + d_lon_m**2)
            
            move_step_m = (self.speed_kmh / 3.6) * 2 
            
            if dist_m < move_step_m:
                self.lat, self.lon = target_lat, target_lon
                self.path_idx += 1
            else:
                self.lat += (d_lat_m / dist_m) * move_step_m / m_per_lat
                self.lon += (d_lon_m / dist_m) * move_step_m / m_per_lon
            
            try:
                # 1. Standard Traccar ingestion (OsmAnd protocol)
                requests.get(PROTO_URL, params={
                    "id": self.device_id, "lat": self.lat, "lon": self.lon,
                    "timestamp": int(time.time()), "speed": self.speed_kmh / 1.852
                }, timeout=2)
                
                # 2. Direct Telemetry Injection (FastAPI) for immediate Dashboard update
                # This bypasses the Traccar->Redis bridge if it's unstable.
                requests.post("http://localhost:8001/api/telemetry/ingest", json={
                    "device_id": self.device_id,
                    "lat": self.lat,
                    "lon": self.lon,
                    "speed_ms": self.speed_kmh / 3.6,
                    "activity_type": 'bicycle' if self.athlete_type == 'BIKE' else 'RUN',
                    "timestamp": time.time()
                }, timeout=2)
            except Exception as e:
                print(f"Ingestion Error for {self.name}: {e}")
                
            time.sleep(2)

def main():
    athletes = [
        ("athlete_001", "Krzysztof Lewandowski", "RUN"), ("athlete_002", "Katarzyna Kowalski", "RUN"),
        ("athlete_003", "Adam Lewandowski", "RUN"), ("athlete_004", "Marek Szymanski", "RUN"),
        ("athlete_005", "Zofia Kaminski", "RUN"), ("athlete_006", "Adam Wojcik", "BIKE"),
        ("athlete_007", "Krzysztof Wisniewski", "BIKE"), ("athlete_008", "Tomasz Wozniak", "BIKE"),
        ("athlete_009", "Ewa Lewandowski", "BIKE"), ("athlete_010", "Marek Kowalski", "BIKE"),
    ]
    
    threads = [BRouterAthleteSimulator(a[0], a[1], a[2]) for a in athletes]
    for t in threads: t.start(); time.sleep(0.1)

    try:
        while True: time.sleep(1)
    except KeyboardInterrupt:
        for t in threads: t.running = False
        for t in threads: t.join()

if __name__ == "__main__":
    main()
