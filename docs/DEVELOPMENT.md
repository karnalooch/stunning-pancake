# 💻 Development Guide — Przewodnik Deweloperski

Przewodnik deweloperski platformy 4VELO — struktura projektu, standardy kodowania, testy, debugging i Git workflow.

---

## 📁 Struktura projektu

```
4VELO/
├── backend/                    # Backend (Django + DRF)
│   ├── core/                   # Konfiguracja Django
│   │   ├── settings.py         # Ustawienia główne
│   │   ├── urls.py             # Główne routowanie
│   │   ├── middleware.py       # Middleware (RLS, Audit)
│   │   ├── wsgi.py             # WSGI entry point
│   │   └── sentry.py           # Sentry initialization
│   ├── users/                  # App: Użytkownicy i RBAC
│   │   ├── models.py           # User, Tenant, AuditLog
│   │   ├── rbac_models.py      # Permission, Role, UserRole
│   │   ├── rbac_views.py       # API RBAC
│   │   ├── rbac_serializers.py # Serializery RBAC
│   │   ├── rbac_urls.py        # URL-e RBAC
│   │   ├── permissions.py      # Klasy uprawnień DRF
│   │   ├── serializers.py      # Serializery User
│   │   ├── views.py            # Widoki User
│   │   ├── urls.py             # URL-e User
│   │   └── migrations/         # Migracje User
│   ├── activities/             # App: Aktywności
│   │   ├── models.py           # Activity, POI, Voucher, PrivacyZone
│   │   ├── views.py            # Widoki aktywności
│   │   ├── admin_views.py      # Widoki admina
│   │   ├── serializers.py      # Serializery
│   │   ├── services.py         # TelemetryService
│   │   ├── wearables.py        # StravaService, GarminService
│   │   ├── tasks.py            # Zadania Celery
│   │   ├── signal_processing.py # Przetwarzanie GPS
│   │   ├── ml_anomaly.py       # ML anomaly detection
│   │   ├── viterbi_matching.py # HMM Viterbi
│   │   ├── leaderboards.py     # Leaderboard logic
│   │   ├── heatmap.py          # Heatmap generation
│   │   ├── analytics.py        # Analytics
│   │   ├── payments.py         # Stripe payments
│   │   ├── payments_views.py   # Payment endpoints
│   │   ├── urls.py             # URL-e aktywności
│   │   └── migrations/         # Migracje Activities
│   ├── clubs/                  # App: Kluby
│   ├── events/                 # App: Wydarzenia
│   ├── rewards/                # App: Nagrody
│   ├── manage.py               # Django management
│   ├── requirements.txt        # Zależności Python
│   ├── Dockerfile              # Docker backend
│   ├── Dockerfile.celery       # Docker Celery worker
│   ├── Dockerfile.celerybeat   # Docker Celery Beat
│   └── railway.json            # Railway config
├── admin/                      # Frontend (React + Mantine)
│   ├── src/
│   │   ├── App.tsx             # Główny komponent
│   │   ├── main.tsx            # Entry point
│   │   ├── api/
│   │   │   └── client.ts       # Axios client + interceptory
│   │   ├── core/
│   │   │   ├── Layout.tsx      # Layout aplikacji
│   │   │   ├── auth/
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   └── useAuth.ts  # Zustand auth store
│   │   │   ├── guards/
│   │   │   │   ├── RoleGuard.tsx
│   │   │   │   └── PermissionGuard.tsx
│   │   │   └── components/
│   │   └── modules/
│   │       ├── dashboard/      # Dashboard
│   │       ├── users/          # Users management
│   │       ├── tenants/        # Tenants + White-Label
│   │       ├── analytics/      # Analytics + Heatmap
│   │       ├── anti-cheat/     # Anti-Cheat dashboard
│   │       ├── sponsor/        # Sponsor dashboard
│   │       ├── settings/       # Settings
│   │       └── public/         # Landing page
│   ├── package.json
│   ├── Dockerfile
│   ├── vite.config.ts
│   └── railway.json
├── mobile/                     # Mobile (React Native + Expo)
├── telemetry/                  # Telemetry (FastAPI)
├── infrastructure/             # Infrastruktura
│   ├── brouter/                # BRouter config
│   └── traccar/                # Traccar config
├── docs/                       # Dokumentacja
├── assets/                     # Zasoby (grafiki, ikony)
├── docker-compose.yml          # Docker Compose (dev)
├── docker-compose.prod.yml     # Docker Compose (prod)
├── .env.example                # Przykładowe zmienne
└── README.md
```

---

## 📝 Standardy kodowania

### Python (Backend)

#### Styl kodowania

- Używaj **PEP 8** jako podstawowego standardu
- Wcięcia: 4 spacje
- Długość linii: max 120 znaków
- Nazwy zmiennych: `snake_case`
- Nazwy klas: `PascalCase`
- Nazwy stałych: `UPPER_SNAKE_CASE`

#### Type hints

```python
from typing import Optional, List, Dict

def get_user_activities(
    user_id: int,
    activity_type: Optional[str] = None,
    limit: int = 50
) -> List[Dict]:
    """Pobiera aktywności użytkownika."""
    ...
```

#### Docstrings

```python
class TelemetryService:
    """
    Service for processing and storing telemetry data.
    
    Handles real-time GPS position ingestion, anomaly detection,
    and live position broadcasting via Redis.
    """
    
    def process_position(self, position: dict) -> bool:
        """
        Process a single GPS position.
        
        Args:
            position: Dictionary with lat, lon, timestamp, speed, etc.
            
        Returns:
            True if position was processed successfully.
        """
        ...
```

#### Importy

```python
# Standard library
import os
import json
from datetime import timedelta

# Third party
from rest_framework import viewsets, permissions
from django.db import models

# Local apps
from .models import Activity
from .serializers import ActivitySerializer
```

### TypeScript/React (Frontend)

#### Styl kodowania

- Używaj **ESLint** + **Prettier**
- Wcięcia: 2 spacje
- Nazwy komponentów: `PascalCase`
- Nazwy funkcji/zmiennych: `camelCase`
- Nazwy typów/interfejsów: `PascalCase`

#### Komponenty funkcyjne

```tsx
interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  trend?: 'up' | 'down';
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend }) => {
  return (
    <Card>
      <Group>
        {icon}
        <div>
          <Text size="sm">{title}</Text>
          <Text size="xl" fw={700}>{value}</Text>
        </div>
      </Group>
    </Card>
  );
};
```

#### Custom hooks

```tsx
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
```

---

## 🧪 Uruchamianie testów

### Backend (Django)

```bash
cd backend

# Uruchom wszystkie testy
python run_tests.py

# Uruchom testy pytest
python run_pytest.py

# Uruchom testy konkretnej aplikacji
python manage.py test users
python manage.py test activities

# Uruchom konkretny test
python manage.py test activities.tests.test_admin

# Z coverage
pip install coverage
coverage run manage.py test
coverage report
coverage html
```

### Frontend (Admin)

```bash
cd admin

# Uruchom testy
npm run test

# Uruchom testy E2E (Playwright)
npm run test:e2e

# Lint
npm run lint

# Type check
npm run type-check
```

### Pisanie testów

#### Testy jednostkowe (Django)

```python
# activities/tests.py
from django.test import TestCase
from activities.models import Activity
from users.models import User

class ActivityModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
    
    def test_activity_creation(self):
        """Test creating an activity."""
        activity = Activity.objects.create(
            user=self.user,
            type='BIKE',
            distance=5000,
            start_time=timezone.now()
        )
        self.assertEqual(activity.user, self.user)
        self.assertEqual(activity.type, 'BIKE')
        self.assertEqual(activity.distance, 5000)
    
    def test_activity_str(self):
        """Test activity string representation."""
        activity = Activity.objects.create(
            user=self.user,
            type='RUN',
            start_time=timezone.now()
        )
        self.assertIn('RUN', str(activity))
```

#### Testy API (DRF)

```python
from rest_framework.test import APITestCase
from rest_framework import status

class ActivityAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
    
    def test_list_activities(self):
        """Test listing activities."""
        response = self.client.get('/api/activities/sessions/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 0)
```

---

## 🆕 Dodawanie nowych funkcji

### Krok 1: Stwórz branch feature

```bash
git checkout main
git pull
git checkout -b feature/nazwa-funkcji
```

### Krok 2: Dodaj modele (jeśli potrzebne)

```python
# activities/models.py
class NewFeature(models.Model):
    """Opis nowej funkcji."""
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return self.name
```

### Krok 3: Utwórz migracje

```bash
python manage.py makemigrations
python manage.py migrate
```

### Krok 4: Dodaj serializery

```python
# activities/serializers.py
class NewFeatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = NewFeature
        fields = ['id', 'name', 'description', 'created_at']
        read_only_fields = ['created_at']
```

### Krok 5: Dodaj widoki

```python
# activities/views.py
class NewFeatureViewSet(viewsets.ModelViewSet):
    """ViewSet for managing new features."""
    queryset = NewFeature.objects.all()
    serializer_class = NewFeatureSerializer
    permission_classes = [permissions.IsAuthenticated]
```

### Krok 6: Dodaj URL-e

```python
# activities/urls.py
from .views import NewFeatureViewSet

router = DefaultRouter()
router.register(r'new-features', NewFeatureViewSet, basename='new-feature')

urlpatterns = [
    path('', include(router.urls)),
    # ...
]
```

### Krok 7: Dodaj testy

```python
# activities/tests.py
class NewFeatureTest(APITestCase):
    def test_create_feature(self):
        """Test creating a new feature."""
        ...
```

### Krok 8: Dodaj frontend (jeśli potrzebne)

```tsx
// admin/src/modules/newfeature/NewFeatureList.tsx
export const NewFeatureList: React.FC = () => {
  const [features, setFeatures] = useState([]);
  
  useEffect(() => {
    apiClient.get('/activities/new-features/').then(({ data }) => setFeatures(data));
  }, []);
  
  return (
    <div>
      {features.map(f => <FeatureCard key={f.id} feature={f} />)}
    </div>
  );
};
```

---

## 🐛 Debugging tips

### Django Debug Mode

```bash
# W .env
DEBUG=1
```

### Django Debug Toolbar

```bash
pip install django-debug-toolbar
```

```python
# settings.py
INSTALLED_APPS += ['debug_toolbar']
MIDDLEWARE += ['debug_toolbar.middleware.DebugToolbarMiddleware']
INTERNAL_IPS = ['127.0.0.1']
```

### Logging SQL queries

```python
# settings.py
LOGGING = {
    'loggers': {
        'django.db.backends': {
            'level': 'DEBUG',
        },
    },
}
```

### Debug Celery

```bash
# Uruchom z verbose logging
celery -A core worker -l debug
```

### Debug frontend

```bash
# React DevTools - zainstaluj rozszerzenie przeglądarki
# Redux DevTools - dla Zustand (z devtools middleware)
```

### Django Shell

```bash
python manage.py shell

# Interaktywny shell_plus (z załadowanymi modelami)
pip install django-extensions
python manage.py shell_plus
```

### Django Shell Plus - przykłady

```python
# Wszystkie modele są automatycznie załadowane
>>> User.objects.count()
>>> Activity.objects.filter(type='BIKE').count()

# Testowanie uprawnień
>>> user = User.objects.first()
>>> user.get_permissions()

# Testowanie RBAC
>>> from users.rbac_models import UserRole, Role
>>> Role.objects.all()
>>> UserRole.objects.filter(user=user)
```

---

## 🔄 Git Workflow

### Branching strategy

```
main ────────────────────────────────────────────────▶
     │         │         │
     ├─feature─┤         │
     │         │         │
     │         ├─feature─┤
     │         │         │
     │         └─fix─────┤
     │                   │
     └─release───────────┤
                         │
                         ▼
                      production
```

### Nazewnictwo branchy

| Typ | Przykład |
|-----|----------|
| Feature | `feature/add-new-endpoint` |
| Bugfix | `fix/cors-headers` |
| Hotfix | `hotfix/security-patch` |
| Release | `release/v0.2.1` |
| Docs | `docs/update-api-reference` |

### Commit messages

Używaj konwencji [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

| Typ | Opis |
|-----|------|
| `feat` | Nowa funkcja |
| `fix` | Naprawa błędu |
| `docs` | Zmiany w dokumentacji |
| `style` | Formatowanie, brak zmian logicznych |
| `refactor` | Refaktoryzacja kodu |
| `test` | Dodanie/zmiana testów |
| `chore` | Aktualizacja zależności, konfiguracji |

**Przykłady:**

```bash
feat(activities): add ML anomaly detection endpoint
fix(auth): resolve JWT refresh token rotation
docs(api): update RBAC endpoint documentation
refactor(users): extract RBAC models to separate file
test(activities): add admin view tests
chore(deps): bump Django to 4.2.30
```

### Process merge

```bash
# 1. Stwórz branch
git checkout -b feature/new-feature

# 2. Commituj zmiany
git add .
git commit -m "feat(activities): add new feature"

# 3. Push
git push origin feature/new-feature

# 4. Stwórz Pull Request na GitHub

# 5. Po review, merge do main

# 6. Usuń branch
git branch -d feature/new-feature
```

---

> **Zobacz także:** [📈 Updates Guide](./UPDATES.md) — aktualizacje zależności  
> **Zobacz także:** [🔍 Troubleshooting](./TROUBLESHOOTING.md) — rozwiązywanie problemów
