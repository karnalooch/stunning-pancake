# Architektura Live-Ghost (System Pozycji Czasu Rzeczywistego)

Dokumentacja nowej funkcji rozgłaszania pozycji kolarzy w czasie rzeczywistym, zgodna z Filarami IV (Privacy-by-Design) oraz II (Mandat 60 FPS) Konstytucji SPORT.

## 1. Schemat WebSocket dla FastAPI (Backend)

FastAPI wykorzystuje Redis Pub/Sub do rozgłaszania pozycji w oparciu o Geohash. Zmniejsza to narzut sieciowy i zapewnia skalowalność.

### Subskrypcja oparta na Geohashu
Klient mobilny subskrybuje kanał WebSocket powiązany z Geohashem regionu, w którym się znajduje (zalecany geohash o długości 5 znaków, obejmujący obszar ok. 4.9 km x 4.9 km).

**Endpoint:** `/api/telemetry/ghosts/live`

### Implementacja Endpointu WebSocket
```python
from fastapi import WebSocket, WebSocketDisconnect
from redis.asyncio import Redis
import asyncio
import json
import pygeohash as pgh

# Redis Pub/Sub Manager dla Live-Ghost
class GhostConnectionManager:
    def __init__(self, redis_url: str):
        self.redis = Redis.from_url(redis_url, decode_responses=True)
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def subscribe_and_broadcast(self, websocket: WebSocket, user_id: int, initial_lat: float, initial_lon: float):
        await websocket.accept()
        current_geohash = pgh.encode(initial_lat, initial_lon, precision=5)
        
        if current_geohash not in self.active_connections:
            self.active_connections[current_geohash] = []
        self.active_connections[current_geohash].append(websocket)

        pubsub = self.redis.pubsub()
        await pubsub.subscribe(f"ghosts:geo:{current_geohash}")

        try:
            # Task 1: Odbieranie wiadomości z Redis i wysyłanie do WebSocket
            async def redis_listener():
                async for message in pubsub.listen():
                    if message["type"] == "message":
                        data = json.loads(message["data"])
                        # Nie wysyłaj własnej pozycji kolarzowi
                        if data.get("user_id") != user_id:
                            await websocket.send_json(data)

            listener_task = asyncio.create_task(redis_listener())

            # Task 2: Nasłuchiwanie aktualizacji pozycji od klienta
            while True:
                client_data = await websocket.receive_json()
                if client_data.get("type") == "client_position":
                    lat = client_data["lat"]
                    lon = client_data["lon"]
                    new_geohash = pgh.encode(lat, lon, precision=5)
                    
                    # Zmiana regionu Geohash
                    if new_geohash != current_geohash:
                        await pubsub.unsubscribe(f"ghosts:geo:{current_geohash}")
                        self.active_connections[current_geohash].remove(websocket)
                        
                        current_geohash = new_geohash
                        if current_geohash not in self.active_connections:
                            self.active_connections[current_geohash] = []
                        self.active_connections[current_geohash].append(websocket)
                        await pubsub.subscribe(f"ghosts:geo:{current_geohash}")

        except WebSocketDisconnect:
            self.active_connections[current_geohash].remove(websocket)
            await pubsub.unsubscribe(f"ghosts:geo:{current_geohash}")
            listener_task.cancel()
```

---

## 2. Logika Filtracji Prywatności (Privacy v2)

Zgodnie z zasadą Privacy-by-Design, pozycje kolarzy w pobliżu stref prywatnych (Dom, Praca) są bezwzględnie filtrowane po stronie serwera.

### Implementacja Filtra Pozycji
```python
import random
from math import radians, cos, sin, asin, sqrt

def calculate_distance(lat1, lon1, lat2, lon2):
    """Oblicza odległość w metrach metodą Haversine."""
    R = 6371000 # Promień Ziemi w metrach
    dLat = radians(lat2 - lat1)
    dLon = radians(lon2 - lon1)
    a = sin(dLat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dLon/2)**2
    return R * 2 * asin(sqrt(a))

def process_ghost_position(user_id: int, lat: float, lon: float, privacy_zones: list[dict]) -> dict | None:
    """
    Weryfikuje strefy prywatności i dodaje jitter.
    Zwraca pozycję do rozgłoszenia lub None, jeśli kolarz jest w strefie prywatnej.
    """
    # 1. Sprawdzenie stref prywatności
    for zone in privacy_zones:
        dist = calculate_distance(lat, lon, zone["center_lat"], zone["center_lon"])
        if dist <= zone["radius_m"]:
            return None  # Wycięcie pozycji z rozgłaszania
            
    # 2. Dodanie lekkiego Jittera (5-10m) dla uniemożliwienia precyzyjnego śledzenia
    # 0.0001 stopnia szerokości geograficznej to ok. 11.1 metra
    jitter_lat = random.uniform(-0.00008, 0.00008)
    jitter_lon = random.uniform(-0.00008, 0.00008)
    
    return {
        "user_id": user_id,
        "lat": lat + jitter_lat,
        "lon": lon + jitter_lon,
        "timestamp": time.time()
    }
```

---

## 3. Projekt UI/UX dla aplikacji mobilnej (Aestetyka Cyber-Monolith)

Zapewnienie 120 FPS przy dynamicznym ruchu kolarzy wymaga użycia warstw natywnych MapLibre.

### Wykorzystanie Legend-State & GeoJSON
Zamiast renderować ikony kolarzy jako komponenty React Native (co powoduje drastyczny spadek wydajności), stosujemy jedno źródło GeoJSON aktualizowane reaktywnie.

```typescript
import { observable } from '@legendapp/state';
import MapLibreGL from '@maplibre/maplibre-react-native';

// Legend-State ultra-fast store
export const ghostsGeoJSON$ = observable({
  type: 'FeatureCollection',
  features: []
});

// Komponent mapy
export const GhostLayer = () => {
  return (
    <MapLibreGL.GeoJSONSource 
      id="ghosts-source" 
      shape={ghostsGeoJSON$.get() as any}
    >
      {/* Poświata wokół kolarza - Cyber Cyan Glow */}
      <MapLibreGL.CircleLayer
        id="ghosts-glow"
        style={{
          circleColor: '#00D1FF',
          circleRadius: 12,
          circleOpacity: 0.4,
          circleBlur: 0.8,
        }}
      />
      
      {/* Marker kolarza */}
      <MapLibreGL.CircleLayer
        id="ghosts-marker"
        style={{
          circleColor: '#00D1FF',
          circleRadius: 6,
          circleStrokeWidth: 2,
          circleStrokeColor: '#FFFFFF',
        }}
      />
    </MapLibreGL.GeoJSONSource>
  );
};
```

### Strategia Zarządzania Energią (Battery-Drain)
1. **Widoczność:** Warstwy Live-Ghost są włączane wyłącznie przy zoomie mapy >= 12.
2. **Throttling:** Serwer rozgłasza pozycję co 3-5 sekund. Płynność ruchu na kliencie symuluje interpolacja liniowa.
