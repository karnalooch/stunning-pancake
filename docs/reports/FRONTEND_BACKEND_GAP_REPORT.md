# 📊 Frontend vs Backend Gap Report


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | pl |
| **translation** | [English](../en/reports/FRONTEND_BACKEND_GAP_REPORT.md) |
| **canonical_path** | docs/reports/FRONTEND_BACKEND_GAP_REPORT.md |

---

## Stan projektu: 30 ekranów admin (46 łącznie z mobile)

---

## ✅ Ekrany z pełnym backendem (22)

| # | Ekran | Backend Endpoint | Status |
|---|-------|-----------------|--------|
| 1 | LoginPage | `/auth/token/` | ✅ |
| 2 | LandingPage | — (static) | ✅ |
| 3 | Dashboard | `/activities/admin/stats/` | ✅ |
| 4 | AntiCheat | `/activities/telemetry/config/`, `/activities/telemetry/anomalies/` | ✅ |
| 5 | Users | `/users/all/`, `/users/create/`, `/users/<id>/delete/` | ✅ |
| 6 | Departments | `/users/departments/` | ✅ |
| 7 | DepartmentUsers | `/users/departments/<id>/users/`, `assign/`, `remove/` | ✅ |
| 8 | ModeratorWorklist | `/activities/admin/approve/`, `/activities/admin/reject/` | ✅ |
| 9 | SettingsScreen | — (frontend only) | ✅ |
| 10 | WhiteLabelEngine | `/users/branding/<tenant_id>/` | ✅ |
| 11 | SponsorDashboard | `/rewards/sponsor-stats/` | ✅ |
| 12 | CityAnalytics | `/activities/analytics/` | ✅ |
| 13 | GlobalHeatmap | `/activities/heatmap/` | ✅ |
| 14 | UserMapView | `/activities/telemetry/live/` | ✅ |
| 15 | AuditLog | `/users/audit-log/` | ✅ |
| 16 | EventsManager | `/api/` (events engine) | ✅ |
| 17 | SponsorshipAnalytics | `/rewards/sponsor-stats/` | ✅ |
| 18 | RewardsVouchers | `/rewards/pools/`, `/rewards/balance/` | ✅ |
| 19 | BetaFeedback | `/activities/beta-feedback/` | ✅ |
| 20 | ActivityTimeline | `/activities/sessions/` | ✅ |
| 21 | TrendAnalysis | `/activities/analytics/` | ✅ |
| 22 | SystemHealth | `/api/infra/health/` | ✅ |

---

## ⚠️ Ekrany z częściowym backendem (5)

| # | Ekran | Co jest | Czego brakuje | Priorytet |
|---|-------|---------|---------------|-----------|
| 23 | **ActivityDetail** | Activity model exists, endpoint `/activities/sessions/<id>/detail/` exists | Frontend uses mock data | 🟡 Średni |
| 24 | **SystemIntelligence** | `/api/ai/insights/` endpoint exists | Frontend uses simulated insights | 🟢 Niski |
| 25 | **RbacManager** | Role/Permission models | Brak endpointów CRUD dla ról i uprawnień | 🟡 Średni |
| 26 | **LeaderboardManager** | LeaderboardService + `recalculate_city_leaderboard` task | Brak endpointów do tworzenia/edycji rankingów | 🟢 Niski |
| 27 | **DepartmentAnalyticsPage** | Frontend component exists | Needs `/activities/analytics/department/` endpoint | 🟡 Średni |

---

## ❌ Ekrany bez backendu (3)

| # | Ekran | Co potrzeba | Priorytet |
|---|-------|-------------|-----------|
| 28 | **ExportCenter** | Endpointy eksportu: `GET /api/activities/export/<resource>/` | 🟡 Średni |
| 29 | **FeatureFlags** | Model FeatureFlag + CRUD API: `GET/POST /api/settings/flags/` — endpoint exists | 🟢 Niski |
| 30 | **ApiPlayground** | — (używa `/api/docs/` — Swagger) | ✅ Gotowe |

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
| ✅ Gotowe (pełny backend) | 22 |
| ⚠️ Częściowe | 5 |
| ❌ Bez backendu | 3 |
| **RAZEM admin** | **30** |
| 📱 Mobile | 16 |
| **RAZEM łącznie** | **46** |

### Backend do zrobienia:
- **0 endpointów** wysoki priorytet — wszystkie krytyczne zrealizowane ✅
- **3 endpointy** średni priorytet (Activity Detail podłączenie, RBAC CRUD, Department Analytics)
- **2 endpointy** niski priorytet (Leaderboard CRUD, Feature Flags CRUD)

**Razem: 5 nowych endpointów do implementacji (koniec prac integracyjnych).**
