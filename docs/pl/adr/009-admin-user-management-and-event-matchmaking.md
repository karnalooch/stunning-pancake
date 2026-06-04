# ADR 009: Admin User Customization and Dynamic Inter-Tenant Matchmaking

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Zobacz dokument kanoniczny |
| **lang** | pl |
| **translation** | [English](../../adr/009-admin-user-management-and-event-matchmaking.md) |
| **canonical_path** | docs/pl/adr/009-admin-user-management-and-event-matchmaking.md |
---

## Stan
Zaakceptowano (21.05.2026)

## Kontekst
Na platformie SPORT/4VELO, w ramach modernizacji portalu administracyjnego w wersji 3.0, postawiono dwa kluczowe pytania dotyczące projektu architektonicznego, dotyczące uprawnień administratora i konfiguracji wydarzeń:
1. **Zakres dostosowywania profilu użytkownika**: Czy administratorzy („GLOBAL_OWNER” lub „TENANT_ADMIN”) powinni mieć uprawnienia do edytowania i przypisywania niestandardowych awatarów i opisów biograficznych innym użytkownikom, czy też powinni jedynie edytować podstawowe informacje o tożsamości („nazwa użytkownika”/„pseudonim”, „e-mail”, „rola”, „najemca”, „hasło”)?
2. **Lista kojarzeń między najemcami**: W przypadku wydarzeń między miastami („INTER_TENANT”), czy selektor miasta/najemcy przeciwnika powinien dynamicznie pobierać i wyświetlać aktywnych najemców z bazy danych, czy też powinien być wstępnie skonfigurowany statycznie?

Obie decyzje otrzymały odpowiedź twierdzącą („Tak”), aby zapewnić maksymalną elastyczność, dynamikę działania i doskonałe doświadczenie administracyjne.

## Decyzja
Wdrożyliśmy i skodyfikowaliśmy następujące specyfikacje architektoniczne:

### 1. Zaawansowana kontrola profilu użytkownika administracyjnego
- **Pełne prawa do dostosowywania**: Administratorzy („GLOBAL_OWNER” i „TENANT_ADMIN”) są upoważnieni do modyfikowania wszystkich aspektów tożsamości użytkowników, w tym niestandardowych adresów URL obrazów awatarów/wskaźników plików i opisów biografii („bio”).
- **Integracja formularzy**: Wysoce wydajna szuflada menedżera użytkowników zawiera dynamiczne pola tekstowe do wprowadzania niestandardowych adresów URL awatarów oraz blok tekstu sformatowanego na szczegółowe informacje o biografii.
- **Wymuszanie zaplecza**: Serializator `UserUpdateView` (`UserAdminUpdateSerializer`) zawiera pola `avatar` i `bio` jako pola do zapisu.
- **RLS i ochrona lunety**:
  - `GLOBAL_OWNER` może edytować awatary/życiorysy na całym świecie, we wszystkich miastach.
  - `TENANT_ADMIN` jest ograniczony przez kontrole backendu do edytowania użytkowników, których `tenant_id` pasuje do ich własnych.

### 2. Dynamiczne kojarzenie miast i miast (między najemcami).
- **Dynamiczne pozyskiwanie selektora**: Podczas konfigurowania zdarzenia typu „INTER_TENANT” (miasto kontra miasto) w formularzu CRUD Menedżera zdarzeń frontend dynamicznie wysyła zapytanie do `/api/users/tenants/all/`, aby pobrać aktywnych miast/najemców.
- **Wybór najemcy przeciwnika**: Ta lista wypełnia menu premium, pozwalające administratorowi wybrać, z którym aktywnym miastem będzie walczyć miasto rodzinne.
- **Rozszerzenie RBAC**:
  - Element `TenantListView` w pliku `backend/users/views.py` został zaktualizowany z `IsGlobalOwner` na `IsTenantAdmin`.
  - Pozwala to `TENANT_ADMIN` na odpytywanie listy aktywnych miast wyłącznie w celu dobierania graczy, przy jednoczesnym zachowaniu ograniczeń RLS w zakresie operacji zapisu.

## Konsekwencje
- **Pozytywne (elastyczność)**: Administratorzy miast mogą teraz w pełni obsługiwać wizualną reprezentację i biografie użytkowników, co jest kluczowe w przypadku zarządzania kontami sponsorów lub markowymi sportowcami.
- **Pozytywne (działania dynamiczne)**: Dopasowania między miastami można organizować na bieżąco, gdy nowi najemcy rejestrują się i stają się aktywni w systemie, eliminując statyczne mapy kodów lub ręczne konfiguracje.
- **Pozytywne (bezpieczeństwo)**: Uprawnienia RLS są ściśle egzekwowane w przypadku operacji zapisu. `TENANT_ADMIN` może czytać listę aktywnych nazw miast, ale ma zerowe uprawnienia do przeglądania list użytkowników lub modyfikowania ustawień innego najemcy.

---

## Pełna wersja (kanoniczna)

Pełny tekst ADR (język źródłowy dokumentu): **[009-admin-user-management-and-event-matchmaking.md](../../adr/009-admin-user-management-and-event-matchmaking.md)**.

> Skrót PL — nie zastępuje pełnego ADR przy review architektury.
