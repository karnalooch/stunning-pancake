# REDESIGN ZARZĄDZANIA UŻYTKOWNIKAMI I LOGIKI (USER MANAGEMENT V2)

Ten dokument opisuje zaktualizowaną architekturę zarządzania użytkownikami, system kontroli dostępu oparty na rolach (RBAC) oraz jego powiązanie z systemem Multi-Tenant (B2B2C) na platformie SPORT. System jest teraz ekosystemem składającym się z Instancji (Tenantów) – gdzie instancją może być „Miasto X” lub „Firma Y”.

## A. Hierarchia Ról i Uprawnienia (Logika Biznesowa)

Oto podział ról w ekosystemie:

1. **GLOBAL_OWNER (Właściciel Platformy)**
   - **Widoczność:** Wszystko („God Mode”).
   - **Uprawnienia:** Tworzenie nowych Instancji (dodawanie miast/firm), globalna analityka całej aplikacji, zarządzanie subskrypcjami i płatnościami (Stripe), banowanie całych organizacji, dostęp do logów systemowych i telemetrii.

2. **TENANT_ADMIN (Integratorzy / Prezydenci Miast / Właściciele Firm)**
   - **Widoczność:** Tylko dane przypisane do ich Instancji (ich miasta/firmy).
   - **Uprawnienia:** Zapraszanie Moderatorów, tworzenie lokalnych wydarzeń/wyzwań (np. „Rowerowy Maj w Warszawie”), przeglądanie zagregowanych statystyk (heatmaps), przypisywanie ról wewnątrz swojej instancji.

3. **TENANT_MODERATOR (Support / Personel Lokalny)**
   - **Widoczność:** Taka sama jak Tenant Admin, ale bez dostępu do ustawień bilingowych i zarządzania innymi użytkownikami administracyjnymi.
   - **Uprawnienia:** Obsługa systemu Anti-Cheat (weryfikacja podejrzanych tras przez BRouter), moderacja zgłoszeń od użytkowników w danym mieście/firmie, akceptowanie wyników z konkretnych wydarzeń.

4. **ATHLETE (Użytkownicy Końcowi / Rowerzyści / Biegacze)**
   - **Widoczność:** Własne statystyki, rankingi miast/klubów, w których biorą udział.
   - **Uprawnienia:** Rejestrowanie tras, dołączanie do wyzwań, definiowanie swoich „Stref Prywatności”, zgłaszanie oszustw przez innych. Może należeć do wielu instancji.

5. **SPONSOR (Właściciele Firm Zewnętrznych)**
   - **Widoczność:** Specjalny „Sponsor Dashboard” powiązany z wydarzeniem, które sponsorują.
   - **Uprawnienia:** Tworzenie nagród/voucherów (Rewards), dodawanie swoich sklepów do mapy (POI), przeglądanie anonimowych statystyk (ilu ludzi skorzystało z vouchera).

---

## B. Implementacja w Kodzie (Czytelność i Struktura)

Aby zachować czystość kodu, ściśle oddzielamy warstwę autoryzacji od logiki biznesowej.

### 1. Backend (Python / Django)
Używamy modelu bazy danych opartego na architekturze Multi-Tenant z tabelą łączącą / kluczem obcym.

**Katalogi i Konwencje Nazewnictwa (Django):**
```text
backend/
├── users/
│   ├── models.py        # CustomUser, Tenant, TenantProfile, UserRole
│   ├── permissions.py   # Klasy: IsGlobalOwner, IsTenantAdmin, IsModerator
│   └── views.py
├── events/
│   ├── models.py        # Event (ma klucz obcy do Tenant)
│   └── views.py
```

**Przykład Logiki Ról (models.py):**
```python
from django.db import models
from django.contrib.auth.models import AbstractUser

class Role(models.TextChoices):
    GLOBAL_OWNER = 'GLOBAL_OWNER', 'Global Owner'
    TENANT_ADMIN = 'TENANT_ADMIN', 'Tenant Admin / Owner'
    TENANT_MODERATOR = 'TENANT_MODERATOR', 'Moderator'
    ATHLETE = 'ATHLETE', 'Athlete'
    SPONSOR = 'SPONSOR', 'Sponsor'

class Tenant(models.Model):
    name = models.CharField(max_length=255) # np. "Miasto Poznań", "Corp X"
    is_active = models.BooleanField(default=True)

class User(AbstractUser):
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.ATHLETE)
    tenant = models.ForeignKey(Tenant, on_delete=models.SET_NULL, null=True, blank=True)
    is_premium = models.BooleanField(default=False)
```

**Niestandardowe Uprawnienia (permissions.py):**
```python
from rest_framework import permissions

class IsTenantAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.role == 'TENANT_ADMIN'
        
    def has_object_permission(self, request, view, obj):
        # Sprawdź, czy edytowany obiekt (np. Event) należy do miasta tego Admina!
        return obj.tenant_id == request.user.tenant_id
```

### 2. Frontend (TypeScript / React)
W aplikacji webowej i mobilnej używamy Context API lub Zustand do trzymania informacji o użytkowniku, aby warunkowo renderować widoki.

**Struktura Katalogów (TypeScript):**
```text
admin/src/
├── core/
│   ├── auth/          # Logika logowania, dekodowanie JWT
│   └── guards/        # ProtectedRoute.tsx (np. <RoleGuard requiredRole="TENANT_ADMIN">)
├── modules/
│   ├── global-admin/  # Widoki TYLKO dla Ciebie (GLOBAL_OWNER)
│   ├── tenant-admin/  # Widoki dla Prezydentów/Firm
│   └── sponsor/       # Dashboardy dla sponsorów
```

---

## C. Dobre Praktyki Architektoniczne i Pro-Tips

W architekturze takich systemów stosujemy poniższe wzorce, aby zapobiec przyszłym pułapkom:

### 1. Baza Danych: Row-Level Security (RLS) w PostgreSQL
Ponieważ obsługujemy różne miasta i firmy, błąd w kodzie mógłby ujawnić dane biegaczy z „Firmy A” szefowi „Firmy B”. PostGIS i PostgreSQL wspierają RLS. 
Na poziomie bazy danych ustawiamy zasadę: *"Użytkownik X może pytać tylko o wiersze, gdzie `tenant_id` zgadza się z jego `tenant_id`"*. Nawet jeśli zapomnimy dodać filtr w widoku Django, baza danych ściśle zablokuje wyciek danych.

### 2. Funkcja „Login As” (Impersonacja)
Jako GLOBAL_OWNER często zachodzi potrzeba zweryfikowania problemów zgłaszanych przez support (np. „Panie Łukaszu, nie widzę wczorajszego przejazdu na moim panelu prezydenckim”).
Implementacja funkcji „Login as” jest niezbędna (w Django jest to bardzo proste). Pozwala ona wejść do panelu, widząc dokładnie to, co widzi dany `TENANT_ADMIN`, bez znajomości jego hasła, za kliknięciem jednego przycisku.

### 3. Feature Toggles na poziomie Instancji (Tenanta)
Tak jak flagujemy płatne funkcje na obiekcie użytkownika (`is_premium`), robimy to samo dla całych instancji.
Jeśli „Miasto Warszawa” płaci za wyższy pakiet, włączamy flagę w ich `TenantProfile`, np. `has_heatmap_analytics = True`. Front-end (React) pobiera te ustawienia przy logowaniu i automatycznie generuje lub ukrywa dedykowane moduły i opcje w sidebarze dla wszystkich moderatorów z Warszawy.
