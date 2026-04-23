# DEVELOPMENT STRATEGY: PYTHON + TYPESCRIPT ("POWER COUPLE")

## 1. Stack Philosophy
Combining Python on the backend and TypeScript on the frontend/mobile provides the perfect balance between computing power and interface stability.

## 2. Backend: Python (Computing Heart)
Python handles heavy business logic, GPS data processing, and analytics.

### Framework Choice
- **Django + Django REST Framework**: Recommended for a quick start thanks to the built-in role system (Admin/Moderator) and "out-of-the-box" management panel.
- **FastAPI**: Alternative for performance-critical endpoints handling thousands of GPS points in real-time.

### Geolocation and Processing
- **PostgreSQL + PostGIS**: Database foundation for professional map data.
- **GeoPandas / Shapely**: Geofencing verification (is the user within city limits) and topological track analysis.

## 3. Frontend and Mobile: TypeScript
The use of TypeScript throughout the client ecosystem guarantees code predictability.

### Admin/Moderator Panel (Web)
- **React / Next.js**: Building a responsive dashboard.
- **TanStack Query**: Efficient state management and data synchronization with the backend.
- **MapLibre GL JS / Leaflet**: Visualization of GPX tracks on city maps.

### Mobile Application (Cross-platform)
- **React Native**: Enables logic sharing in TypeScript between web and mobile.
- **Background Geolocation**: Key module for precise track recording with the screen off.

## 4. MVP Architecture and Scalability
1.  **User (TS)**: Records points -> Sends JSON every 30s.
2.  **Backend (Python)**: Receives -> Validates (PostGIS) -> Saves.
3.  **Admin (TS)**: Displays calculated rankings and statistics.

## 5. Business Model in Code
- **Feature Toggles**: `is_premium` flags in the database.
- **Python Decorators**: Access control for advanced statistics and data export at the backend code level.

## 6. First Step
Initialization of a Django project with the Django REST Framework (DRF) module.
