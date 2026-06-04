# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Zobacz dokument kanoniczny |
| **lang** | pl |
| **translation** | [English](../../compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md) |
| **canonical_path** | docs/pl/compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md |
---

| | |
|--|--|
| **Stan** | ✅Aktywny |
| **Rola właściciela** | Menedżer ds. wersji / Dział prawny |
| **Ostatnia recenzja** | 2026-06-03 |
| **Publiczność** | Menedżer wersji |
| **Indeks** | [COMPLIANCE_INDEX.md](../../compliance/COMPLIANCE_INDEX.md) |

Praktyczny pakiet wprowadzający na rynek dla każdego wydania produkcyjnego.

Używaj razem z:
- `docs/reports/RELIABILITY_AUDIT_PLAYBOOK.md`
- `docs/operations/PRE_RELEASE_VERIFICATION.md`

## 1) Lista kontrolna zgodności licencji OSS

### Powiadomienia innych firm (administrator + backend)

| Artefakt | Lokalizacja |
|---------|----------|
| Wygenerowane powiadomienia | [`THIRD_PARTY_NOTICES.md`](../../../THIRD_PARTY_NOTICES.md) (korzeń repozytorium) |
| Generator | [`scripts/compliance/generate-trzeciej-notices.mjs`](../../../scripts/compliance/generate-third-party-notices.mjs) |

**Regeneruj przed wydaniem** (z katalogu głównego repozytorium):```bash
# Admin: uses package-lock.json only (no network)
node scripts/compliance/generate-third-party-notices.mjs

# Or from admin/
cd admin && npm run licenses:report

# Backend: install deps for full pip metadata (recommended)
pip install -r backend/requirements.txt
pip install pip-licenses
node scripts/compliance/generate-third-party-notices.mjs

# CI / pre-release gate (fails on GPL/AGPL/UNKNOWN)
node scripts/compliance/generate-third-party-notices.mjs --check
```Commit the updated `THIRD_PARTY_NOTICES.md` with the release tag.

Każdy release musi mieć komplet:

- [ ] `THIRD_PARTY_NOTICES.md` wygenerowany/odświeżony z aktualnych zależności (patrz powyżej).
- [ ] SBOM wygenerowany dla backend i admin (np. CycloneDX/SPDX) i zarchiwizowany jako artifact release.
- [ ] Skan licencji zależności wykonany (`pip-licenses` + `license-checker` lub równoważne).
- [ ] Wszystkie licencje copyleft (GPL/AGPL/LGPL) przeanalizowane pod kątem dystrybucji i obowiązków.
- [ ] Zależności bez rozpoznanej licencji oznaczone jako blocker (No-Go) do czasu wyjaśnienia.
- [ ] Link do paczki zgodności dodany w notatkach release (repo/tag).

Minimalny dowód:
- Artifact: `sbom-backend.json`, `sbom-admin.json`
- Artifact: raport skanu licencji
- Commit/tag: aktualizacja `THIRD_PARTY_NOTICES.md`

## 2) GDPR / data protection checklist

- [ ] Rejestr danych osobowych zaktualizowany (`docs/compliance/RCP.md`).
- [ ] DPA/umowy powierzenia aktywne dla wszystkich processorów (hosting, e-mail, płatności, mapy, analityka).
- [ ] Privacy Policy i Terms of Service odzwierciedlają aktualne przepływy danych.
- [ ] Data retention i deletion flow działają (manualny test usunięcia/anonimizacji).
- [ ] Podstawy prawne dla danych wrażliwych/biometrycznych potwierdzone.
- [ ] Rejestrowanie zgód użytkownika (timestamp + source) działa i jest audytowalne.
- [ ] Mechanizm eksportu/usunięcia danych (DSAR) ma ownera operacyjnego i SLA.
- [ ] Transfery poza EOG (jeśli są) mają podstawę (SCC/adequacy).

No-Go przykłady:
- brak ważnej podstawy prawnej dla nowej kategorii danych,
- brak drogi realizacji DSAR w SLA,
- niezgodność dokumentacji prawnej z faktycznym przetwarzaniem.

## 3) External providers ToS checklist

Zweryfikuj dla każdej integracji aktywnej w release:

- [ ] Stripe (payments/billing): zgodność z ToS, webhook security, PCI scope jasny.
- [ ] Email provider (np. SendGrid/Mailgun): anti-spam, unsubscribe, retention, suppression lists.
- [ ] Maps/routing (Mapbox/Google/BRouter źródła danych): limits, attribution, tiles usage policy.
- [ ] Admin basemap: OpenFreeMap / OSM attribution — `docs/compliance/MAP_BASEMAP_LICENSING.md` (no CARTO `cartocdn.com` in production).
- [ ] Social auth/sharing (Google/Apple/Meta/X): branding guidelines, token handling, approved scopes.
- [ ] Monitoring/analytics (Sentry/Datadog itp.): data minimization, PII scrubbing, retention.

Dla każdej integracji:
- [ ] owner biznesowy i owner techniczny,
- [ ] data classification (PII/non-PII),
- [ ] link do aktualnego ToS/DPA i data ostatniego review.

## 4) Release legal gate (Go/No-Go)

### GO tylko gdy:
- [ ] OSS compliance complete
- [ ] GDPR/data protection complete
- [ ] Provider ToS review complete
- [ ] Brak otwartych krytycznych ryzyk prawnych (P0/P1 legal)
- [ ] Decyzja podpisana przez ownera release i ownera legal/compliance

### NO-GO gdy:
- [ ] brakuje dowodów (SBOM/licensing/report),
- [ ] nowa integracja bez review ToS/DPA,
- [ ] brak decyzji ownera legal/compliance,
- [ ] wykryta niezgodność z polityką danych lub regulacjami.

## 5) Release template (wypełnij dla każdego wydania)

Skopiuj sekcję poniżej do notatek release:```md
# Release Legal + Compliance Checklist

Release: <version/tag>
Date: <YYYY-MM-DD>
Release owner: <name>
Legal/compliance owner: <name>

## OSS
- THIRD_PARTY_NOTICES updated: [ ] yes [ ] no
- SBOM backend/admin attached: [ ] yes [ ] no
- Dependency license scan attached: [ ] yes [ ] no
- Copyleft/legal review required: [ ] yes [ ] no
Notes:

## GDPR / Data Protection
- RCP updated: [ ] yes [ ] no
- DSAR/export/delete flow verified: [ ] yes [ ] no
- Privacy policy / ToS reviewed: [ ] yes [ ] no
- Processor agreements valid: [ ] yes [ ] no
Notes:

## External Providers
- Stripe reviewed: [ ] yes [ ] no
- Email provider reviewed: [ ] yes [ ] no
- Maps/routing reviewed: [ ] yes [ ] no
- Social/identity reviewed: [ ] yes [ ] no
Notes:

## Decision
- GO / NO-GO: <decision>
- Rationale:
- Approvals:
  - Release owner: <name + date>
  - Legal/compliance owner: <name + date>
```
