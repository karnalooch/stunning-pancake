# BUSINESS MODEL AND ANTI-CHEAT LOGIC

## 1. Commercialization Paths
Thanks to the White-Label architecture, the platform can be offered in multiple models:

### B2B: Corporate Wellness
- **Product**: A closed platform for company employees.
- **Value**: Team integration, health improvement, company branding.
- **Technology**: Data isolation via Traccar Groups, custom POI maps with office locations.

### B2G: Active Cities / Municipalities
- **Product**: Official municipal app for sports competition.
- **Value**: Regional promotion, data for cycling infrastructure planning.
- **Technology**: Global leaderboards in Redis, analytics of popular routes (heatmaps).

### B2C: Freemium
- **Product**: App for sports enthusiasts.
- **Value**: Precise telemetry, unique vector maps, training plans.

## 2. Anti-Cheat System and Verification
Competition for rewards requires a rigorous fight against fraud.

### On-Device Layer
- **Mock Location Detection**: Detecting fake location providers (Android/iOS system API).
- **Accelerometer Analysis**: Movement classification (running vs. car) based on vibration patterns.

### Fast Selection Gate Layer (NEW)
Launched **before** Kalman and BRouter. Zero I/O. Pure O(N) mathematics.

| Test | Threshold | Blocks |
|:---|:---:|:---|
| TELEPORT | >500 m/jump | GPS spoof, vehicle |
| ACCELERATION | >6 m/s² | Tram, car, motorcycle |
| MOTOR FINGERPRINT | Velocity CV <5% | Bus, rail, ship |
| STRAIGHT-LINE RATIO | >92% | Road/rail vehicle |

### Kinematic Layer (V-max Check)
- Biomechanical speed thresholds per sport with a 10% margin.
- Rejection at >20% segments above threshold or ≥3 consecutive violations.

### Server Layer (Cloud Validation — BRouter)
- **BRouter Map-Matching**: Checking if the route crosses physical barriers (walls, rivers) without infrastructure.
- Called **only** if the Fast Gate and V-max layers pass successfully.
- **Heart Rate Correlation**: Requirement of heart rate monitor data for "Pro" rankings.

## 3. Gamification: Scoring Mechanism
- **Normalization**: Points = (Distance * Elevation) / Number of group participants. This allows for fair competition of small companies with giants.
- **Challenges**: Time-limited challenges (Sprints) based on Traccar geographic zones (Geofencing).
