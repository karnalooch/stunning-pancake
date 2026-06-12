# Szablon DPIA — kampania 4VELO per tenant

| | |
|--|--|
| **Status** | Active — template |
| **Wersja** | 1.0 |
| **Data** | 2026-06-12 |
| **Owner** | DPO / Legal |
| **Audience** | JST, firma, organizator ligi |
| **lang** | pl |
| **translation** | [English](../../en/compliance/DPIA_TEMPLATE.md) |
| **canonical_path** | docs/gtm/pl/compliance/DPIA_TEMPLATE.md |
| **Podprocesorzy** | [SUBPROCESSORS_TEMPLATE.md](./SUBPROCESSORS_TEMPLATE.md) |

---

## Jak wypełnić per tenant

1. Zamień wszystkie placeholdery `[...]` na dane konkretnego tenanta.
2. Uzupełnij [SUBPROCESSORS_TEMPLATE.md](./SUBPROCESSORS_TEMPLATE.md) i dołącz jako załącznik.
3. Skonsultuj z DPO administratora (tenant) i operatorem platformy (4VELO).
4. Podpisz przed publikacją kampanii i rejestracją pierwszych uczestników.
5. Przechowuj wersję podpisaną poza repozytorium (nie commituj danych osobowych).

---

## 1. Identyfikacja przetwarzania

| Pole | Wartość |
|------|---------|
| **Nazwa przetwarzania** | Kampania sportowa 4VELO — `[NAZWA_KAMPANII]` |
| **Tenant / administrator** | `[NAZWA_TENANTA]` — `[MIASTO/FIRMA]` |
| **Operator platformy** | `[NAZWA_OPERATORA_4VELO]` |
| **Okres kampanii** | `[DATA_START]` — `[DATA_KONIEC]` |
| **Data DPIA** | `[DATA_DPIA]` |
| **Wersja** | 1.0 |

**Model ról RODO:** Administrator danych = `[NAZWA_TENANTA]` (decyzje o celach i zakresie kampanii). Procesor = operator platformy 4VELO (hosting, anti-cheat, rankingi). Współadministrowanie — jeśli dotyczy — opisać w §8.

---

## 2. Opis przetwarzania

### Cele

| Cel | Opis |
|-----|------|
| Prowadzenie kampanii / ligi | Rejestracja, rankingi, wyzwania między działami/klubami |
| Weryfikacja aktywności | GPS tracking, anti-cheat, normalizacja wyniku |
| Komunikacja z uczestnikami | Powiadomienia push, e-mail kampanii, status weryfikacji |
| Raportowanie dla decydenta | Statystyki km, uczestnictwo, heatmapy (anonimizowane agregaty) |

### Kategorie osób

- Pracownicy / mieszkańcy / członkowie klubu biorący udział w kampanii.
- Moderatorzy i administratorzy tenanta.
- Opcjonalnie: goście z zaproszeniem (link/kod).

### Kategorie danych

| Kategoria | Przykłady | Wrażliwość |
|-----------|-----------|------------|
| Identyfikacyjne | E-mail, nazwa użytkownika, ID konta | Standard |
| Lokalizacyjne | Ślad GPS, strefy prywatności (maskowanie domu) | Podwyższona |
| Zdrowotne / sprawność | Wzrost, waga, wiek (jeśli podane), tętno (opcjonalnie) | Szczególne kategorie — tylko za zgodą |
| Techniczne | Device ID, logi aplikacji, IP | Standard |

Dyscypliny objęte kampanią: **rower, bieg, nordic walking** wyłącznie.

---

## 3. Podstawy prawne (RODO)

| Cel | Podstawa (art. 6 RODO) | Uwagi |
|-----|------------------------|-------|
| Udział w kampanii, ranking | lit. b — wykonanie umowy / regulaminu | Regulamin kampanii obowiązkowy |
| Anti-cheat, bezpieczeństwo | lit. f — prawnie uzasadniony interes | Interes w uczciwych wynikach |
| Marketing kampanii (opcjonalnie) | lit. a — zgoda | Oddzielna zgoda, możliwość wycofania |
| Dane biometryczne / zdrowotne | lit. a — wyraźna zgoda (art. 9) | Tylko jeśli zbierane |

---

## 4. Ocena konieczności i proporcjonalności

| Pytanie | Odpowiedź |
|---------|-----------|
| Czy GPS jest niezbędny do celu? | Tak — weryfikacja aktywności sportowej na zewnątrz |
| Czy można ograniczyć dokładność? | Tak — strefy prywatności, agregaty na heatmapach |
| Okres przechowywania | Dane konta: okres kampanii + `[X]` miesięcy; logi surowe: max 90 dni |
| Dostęp moderatora | Ograniczony do case'ów anti-cheat i supportu |

---

## 5. Analiza ryzyka

| Ryzyko | Prawdopodobieństwo | Skutek | Środki zaradcze | Resztkowe |
|--------|-------------------|--------|-----------------|-----------|
| Ujawnienie dokładnej lokalizacji domu | Średnie | Wysoki | Strefy prywatności, maskowanie, brak publicznych śladów w strefie | Niskie |
| Fałszywe oskarżenie o oszustwo | Niskie | Średni | Proces appeal, moderacja bez publicznych oskarżeń | Niskie |
| Wyciek danych u podprocesora | Niskie | Wysoki | DPA, lista podprocesorów, szyfrowanie w tranzycie | Niskie |
| Przetwarzanie poza EOG | Średnie | Średni | SCC / DPA z hostingiem, dokumentacja transferu | Średnie |
| Profilowanie bez zgody | Niskie | Średni | Normalizacja bez decyzji wyłącznie automatycznej wobec osób | Niskie |

---

## 6. Środki techniczne i organizacyjne

- Szyfrowanie TLS w tranzycie; szyfrowanie bazy w spoczynku (hosting).
- RBAC w panelu admina; audit log decyzji moderacyjnych.
- Anti-cheat 4 warstwy — [ANTI_CHEAT_SCORING_POLICY.md](../trust/ANTI_CHEAT_SCORING_POLICY.md).
- Procedura usuwania / anonimizacji konta po zakończeniu kampanii.
- Incydenty: powiadomienie administratora i UODO w terminach RODO.

---

## 7. Prawa osób

Uczestnicy mają prawo do: dostępu, sprostowania, usunięcia, ograniczenia, przenoszenia (gdy dotyczy), sprzeciwu, cofnięcia zgody. Kontakt: `[EMAIL_IOD_TENANTA]`.

---

## 8. Współadministrowanie (opcjonalnie)

Jeśli `[NAZWA_TENANTA]` i operator 4VELO współadministrują:

| Element | Tenant | Operator 4VELO |
|---------|--------|----------------|
| Cele kampanii | ✓ | — |
| Infrastruktura, anti-cheat | — | ✓ |
| Punkt kontaktowy dla osób | `[EMAIL]` | `[EMAIL_OPERATORA]` |
| Umowa współadministrowania | Załącznik `[NR_UMOWY]` | |

---

## 9. Zatwierdzenie

| Rola | Imię i nazwisko | Data | Podpis |
|------|-----------------|------|--------|
| DPO / IOD tenant | | | |
| Reprezentant tenant | | | |
| Operator platformy | | | |

---

## Checklist przed podpisem

- [ ] Placeholdery uzupełnione
- [ ] [SUBPROCESSORS_TEMPLATE.md](./SUBPROCESSORS_TEMPLATE.md) załączony i aktualny
- [ ] Regulamin kampanii zgodny z [REGULAMIN_KAMPANII_TEMPLATE.md](../campaign-start/REGULAMIN_KAMPANII_TEMPLATE.md)
- [ ] Privacy Policy / ToS użytkownika zaktualizowane
- [ ] DPA z operatorem platformy podpisane
- [ ] Wersja podpisana zarchiwizowana (poza repo)
