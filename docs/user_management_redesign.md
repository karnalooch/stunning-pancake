# RE-DESIGN LOGIKI UŻYTKOWNIKÓW I ZARZĄDZANIA (USER MANAGEMENT V2)

Ten dokument opisuje zaktualizowaną architekturę zarządzania użytkownikami, system ról (RBAC), oraz powiązanie z systemem Multi-Tenant (B2B2C) na platformie SPORT. System to teraz ekosystem składający się z Instancji (Tenants) – gdzie Instancją może być "Miasto X" lub "Firma Y".

## A. Hierarchia Ról i Uprawnienia (Logika Biznesowa)

Oto podział ról w ekosystemie:

1. **GLOBAL_OWNER (Właściciel / Platform Owner)**
   - **Co widzi:** Wszystko ("God Mode").
   - **Uprawnienia:** Tworzenie nowych Instancji (dodawanie miast/firm), globalna analityka całej aplikacji, zarządzanie subskrypcjami i płatnościami (Stripe), banowanie całych organizacji, dostęp do logów i telemetrii systemu.

2. **TENANT_ADMIN (Integratorzy / Prezydenci Miast / Właściciele Firm)**
   - **Co widzi:** Tylko dane przypisane do swojej Instancji (swojego miasta/firmy).
   - **Uprawnienia:** Zapraszanie Moderatorów, tworzenie lokalnych wydarzeń/wyzwań (np. "Rowerowy Maj w Warszawie"), podgląd zagregowanych statystyk (heatmaps), przydzielanie ról w obrębie swojej instancji.

3. **TENANT_MODERATOR (Wsparcie / Obsługa lokalna)**
   - **Co widzi:** To samo co Tenant Admin, ale bez dostępu do ustawień rozliczeniowych i zarządzania innymi użytkownikami administracyjnymi.
   - **Uprawnienia:** Obsługa systemu Anti-Cheat (weryfikacja podejrzanych tras BRouterem), moderowanie zgłoszeń od użytkowników z danego miasta/firmy, akceptowanie wyników z konkretnych eventów.

4. **ATHLETE (Użytkownicy / Rowerzyści / Biegacze)**
   - **Co widzi:** Własne statystyki, rankingi miast/klubów, w których bierze udział.
   - **Uprawnienia:** Nagrywanie tras, dołączanie do wyzwań, definiowanie swoich "Stref Prywatności" (Privacy Zones), zgłaszanie oszustw u innych. Może należeć do wielu instancji.

5. **SPONSOR (Właściciele firm zewnętrznych)**
   - **Co widzi:** Specjalny "Sponsor Dashboard" powiązany z wydarzeniem, które sponsorują.
   - **Uprawnienia:** Tworzenie nagród/voucherów (Rewards), dodawanie swoich sklepów do mapy (POI), podgląd anonimowych statystyk (ile osób wykorzystało voucher).

---

## B. Implementacja w Kodzie (Czytelność i Struktura)

Aby kod był czysty, twardo oddzielamy warstwę uprawnień od logiki biznesowej.

### 1. Backend (Python / Django)
Stosujemy model bazy danych oparty na architekturze Multi-Tenant z tabelą pośredniczącą/kluczem obcym.

**Katalogi i nazewnictwo (Django):**
```text
backend/
├── users/
│   ├── models.py        # CustomUser, Tenant, TenantProfile, UserRole
│   ├── permissions.py   # Klasy: IsGlobalOwner, IsTenantAdmin, IsModerator
│   └── views.py
├── events/
│   ├── models.py        # Event (posiada klucz obcy do Tenant)
│   └── views.py
```

**Przykład logiki ról (models.py):**
```python
from django.db import models
from django.contrib.auth.models import AbstractUser

class Role(models.TextChoices):
    GLOBAL_OWNER = 'GLOBAL_OWNER', 'Właściciel'
    TENANT_ADMIN = 'TENANT_ADMIN', 'Prezydent / Właściciel Firmy'
    TENANT_MODERATOR = 'TENANT_MODERATOR', 'Moderator'
    ATHLETE = 'ATHLETE', 'Sportowiec'
    SPONSOR = 'SPONSOR', 'Sponsor'

class Tenant(models.Model):
    name = models.CharField(max_length=255) # np. "Miasto Poznań", "Korporacja X"
    is_active = models.BooleanField(default=True)

class User(AbstractUser):
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.ATHLETE)
    tenant = models.ForeignKey(Tenant, on_delete=models.SET_NULL, null=True, blank=True)
    is_premium = models.BooleanField(default=False)
```

**Customowe uprawnienia (permissions.py):**
```python
from rest_framework import permissions

class IsTenantAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.role == 'TENANT_ADMIN'
        
    def has_object_permission(self, request, view, obj):
        # Sprawdź czy edytowany obiekt (np. Event) należy do miasta tego Admina!
        return obj.tenant_id == request.user.tenant_id
```

### 2. Frontend (TypeScript / React)
W aplikacji webowej i mobilnej używamy Context API lub Zustanda (Zustand) do trzymania informacji o użytkowniku, aby warunkowo renderować widoki.

**Struktura katalogów (TypeScript):**
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

## C. Dobre Praktyki i Pro-tipy Architektoniczne

W architekturze takich systemów stosujemy poniższe wzorce, aby zapobiec pułapkom w przyszłości:

### 1. Baza Danych: Row-Level Security (RLS) w PostgreSQL
Skoro obsługujemy różne miasta i firmy, błąd w kodzie mógłby pokazać dane biegaczy z "Firmy A" szefowi z "Firmy B". PostGIS i PostgreSQL wspierają RLS. 
Na poziomie bazy danych zakładamy regułę: *"Użytkownik X może odpytywać tylko wiersze, gdzie `tenant_id` zgadza się z jego `tenant_id`"*. Nawet w przypadku, gdy zapomnimy dodać filtru w widoku Django, baza danych twardo zablokuje wyciek danych.

### 2. Funkcja "Zaszywania się" (Impersonation / Login As)
Jako GLOBAL_OWNER często pada potrzeba weryfikacji problemów zgłaszanych przez wsparcie (np. "Panie Łukaszu, na moim panelu prezydenta nie widzę wczorajszego biegu").
Konieczna jest implementacja funkcji "Zaloguj jako" (w Django to bardzo proste). Pozwala to wejść do panelu, widząc dokładnie to samo, co widzi dany `TENANT_ADMIN`, bez znania jego hasła, z poziomu jednego przycisku.

### 3. Feature Toggles (Flagi) na poziomie Instancji (Tenant)
Tak jak flagujemy płatne funkcje na obiekcie użytkownika (`is_premium`), robimy to samo dla całych instancji.
Jeśli "Miasto Warszawa" zapłaci za wyższy pakiet, włączamy w ich `TenantProfile` flagę np. `has_heatmap_analytics = True`. Front-end (React) pobiera te ustawienia przy logowaniu i automatycznie wygeneruje lub ukryje dedykowane moduły i opcje w bocznym menu dla wszystkich moderatorów z Warszawy.
