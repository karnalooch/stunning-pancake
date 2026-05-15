# 📊 Frontend vs Backend Gap Report

## Stan projektu: 27 ekranów frontend

---

## ✅ Ekrany z pełnym backendem (15)

| # | Ekran | Backend Endpoint | Status |
|---|-------|-----------------|--------|
| 1 | LoginPage | `/auth/token/` | ✅ |
| 2 | LandingPage | — (static) | ✅ |
| 3 | Dashboard | `/activities/admin/stats/` | ✅ |
| 4 | AntiCheat | `/activities/telemetry/config/`, `/activities/telemetry/anomalies/` | ✅ |
| 5 | Users | `/users/all/`, `/users/create/`, `/users/<id>/delete/` | ✅ |
| 6 | Departments | `/users/rbac/departments/` | ✅ |
| 7 | DepartmentUsers | `/users/rbac/user-departments/` | ✅ |
| 8 | ModeratorWorklist | `/activities/admin/stats/`, `/activities/admin/approve/`, `/activities/admin/reject/` | ✅ |
| 9 | SettingsScreen | — (frontend only) | ✅ |
| 10 | WhiteLabelEngine | `/users/branding/<tenant_id>/` | ✅ |
| 11 | SponsorDashboard | `/rewards/sponsor-stats/` | ✅ |
| 12 | CityAnalytics | `/activities/analytics/` | ✅ |
| 13 | GlobalHeatmap | `/activities/heatmap/` | ✅ |
| 14 | UserMapView | `/activities/telemetry/live/` | ✅ |
| 15 | AuditLog | `/users/audit-log/` | ✅ |

---

## ⚠️ Ekrany z częściowym backendem (5)

| # | Ekran | Co jest | Czego brakuje | Priorytet |
|---|-------|---------|---------------|-----------|
| 16 | **ActivityDetail** | Activity model exists | Brak endpointu `/activities/<id>/detail/` z pełnymi danymi (route_path, anti-cheat results) | 🔴 Wysoki |
| 17 | **SystemIntelligence** | — | Brak endpointu `/api/ai/insights/` — AI insights generowane po stronie frontendu | 🟡 Średni |
| 18 | **SystemHealth** | — | Brak endpointu `/api/infra/health/` — health checki Redis, DB, Celery | 🟡 Średni |
| 19 | **RbacManager** | Role/Permission models | Brak endpointów CRUD dla ról i uprawnień | 🟡 Średni |
| 20 | **LeaderboardManager** | LeaderboardService | Brak endpointów do tworzenia/edycji rankingów | 🟢 Niski |

---

## ❌ Ekrany bez backendu (4)

| # | Ekran | Co potrzeba | Priorytet |
|---|-------|-------------|-----------|
| 21 | **ExportCenter** | Endpointy eksportu: `GET /api/export/activities.csv`, `GET /api/export/users.json`, `GET /api/export/stats.pdf` | 🟡 Średni |
| 22 | **FeatureFlags** | Model FeatureFlag + CRUD API: `GET/POST /api/settings/flags/` | 🟢 Niski |
| 23 | **ApiPlayground** | — (używa `/api/docs/` — Swagger) | ✅ Gotowe |
| 24 | **MobileNav** | — (frontend only) | ✅ Gotowe |

---

## 📋 Backend TODO — lista zadań

### 🔴 Wysoki priorytet

#### 1. Activity Detail Endpoint
```python
# backend/activities/views.py
class ActivityDetailView(generics.RetrieveAPIView):
    queryset = Activity.objects.select_related('user', 'tenant').all()
    serializer_class = ActivityDetailSerializer
    
# backend/activities/serializers.py
class ActivityDetailSerializer(serializers.ModelSerializer):
    route_path = serializers.SerializerMethodField()
    anti_cheat_results = serializers.SerializerMethodField()
    
    class Meta:
        model = Activity
        fields = ['id', 'user', 'type', 'start_time', 'end_time', 'distance', 
                  'duration', 'is_verified', 'verification_score', 'route_path',
                  'anti_cheat_results', 'created_at']
```

### 🟡 Średni priorytet

#### 2. System Health Endpoint
```python
# backend/core/views.py
class SystemHealthView(APIView):
    def get(self, request):
        health = {
            'backend': {'status': 'healthy', 'uptime': get_uptime()},
            'database': check_postgres(),
            'redis': check_redis(),
            'celery': check_celery(),
        }
        return Response(health)
```

#### 3. AI Insights Endpoint
```python
# backend/activities/views.py
class AIInsightsView(APIView):
    def get(self, request):
        insights = generate_ai_insights()  # LLM call or rule-based
        return Response(insights)
```

#### 4. RBAC Manager Endpoints
```python
# backend/users/rbac_views.py
class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer

class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
```

#### 5. Export Endpoints
```python
# backend/activities/views.py
class ExportActivitiesView(APIView):
    def get(self, request):
        format = request.query_params.get('format', 'csv')
        # Generate and return file
```

### 🟢 Niski priorytet

#### 6. Leaderboard Manager Endpoints
```python
# backend/activities/views.py
class LeaderboardViewSet(viewsets.ModelViewSet):
    # CRUD for custom leaderboards
```

#### 7. Feature Flags
```python
# backend/core/models.py
class FeatureFlag(models.Model):
    key = models.CharField(max_length=100, unique=True)
    enabled = models.BooleanField(default=False)
    description = models.TextField(blank=True)
```

---

## 📊 Podsumowanie

| Kategoria | Liczba |
|-----------|--------|
| ✅ Gotowe (pełny backend) | 15 |
| ⚠️ Częściowe | 5 |
| ❌ Bez backendu | 4 |
| **RAZEM** | **24** |

### Backend do zrobienia:
- **1 endpoint** wysoki priorytet (Activity Detail)
- **4 endpointy** średni priorytet (Health, AI, RBAC, Export)
- **2 endpointy** niski priorytet (Leaderboard, FeatureFlags)

**Razem: 7 nowych endpointów do implementacji.**
