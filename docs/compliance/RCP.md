# REJESTR CZYNNOŚCI PRZETWARZANIA (RCP) — SPORT


| | |
|--|--|
| **Status** | PRE-PRODUCTION — working record |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-09-28 |
| **Audience** | See canonical document |
| **lang** | pl |
| **translation** | [English](../en/compliance/RCP.md) |
| **canonical_path** | docs/compliance/RCP.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | DPO / Legal |
| **Last reviewed** | 2026-09-28 |
| **Audience** | DPO, Legal, Product |

**Indeks:** [COMPLIANCE_INDEX.md](./COMPLIANCE_INDEX.md) · **FAQ użytkownika:** [product/FAQ.md](../product/FAQ.md)

## 1. Administrator / procesor
Finalny podmiot prawny operatora 4VELO oraz role administrator/procesor dla poszczególnych modeli wdrożenia nie są jeszcze zatwierdzone w dokumentacji produkcyjnej. Publiczny pilot pozostaje NO-GO w kanonicznym gate T58. Przed pierwszym przetwarzaniem danych rzeczywistych użytkowników trzeba ustalić operatora, role 4VELO i tenanta oraz faktycznych procesorów.

## 2. Kategorie Danych Osobowych
| Kategoria | Dane | Cel |
| :--- | :--- | :--- |
| **Identyfikacyjne** | Email, Username, Kod QR | Rejestracja, logowanie |
| **Lokalizacyjne** | Ślady GPS, Strefy Prywatności | Tracking aktywności, Anti-cheat |
| **Profil / fizjologia** | Wiek, wzrost, waga, parametry sprawności | Konfiguracja profilu, scoring/analityka |
| **Dane dotyczące zdrowia** | Tętno lub metryki ujawniające stan fizyczny/zdrowotny, jeśli aktywne | Analityka sportowa |
| **Płatnicze** | Identyfikatory i status transakcji otrzymywane od operatora płatności | Subskrypcje, nagrody, jeśli aktywne |

Wzrost, waga, wiek i tętno nie są automatycznie danymi biometrycznymi w rozumieniu RODO. Biometria ma węższą definicję związaną ze specjalnym przetwarzaniem cech w celu jednoznacznej identyfikacji osoby.

## 3. Podstawy prawne
Podstawa prawna musi być przypisana per cel. Art. 6 ust. 1 lit. b może obejmować wyłącznie operacje rzeczywiście niezbędne do wykonania usługi. Anti-cheat i bezpieczeństwo wymagają osobnej analizy, np. uzasadnionego interesu i testu równowagi. Marketing wymaga niezależnej podstawy. Jeżeli aktywne są dane dotyczące zdrowia, potrzebny jest również właściwy wyjątek z art. 9 ust. 2 RODO. Istotne decyzje oparte wyłącznie na automatycznym przetwarzaniu wymagają osobnej analizy art. 22 RODO i zabezpieczeń dla użytkownika.

## 4. Retencja danych
Repozytorium zawiera częściowe mechanizmy i cele retencji, ale obecny audyt wskazuje brak jednej zweryfikowanej macierzy retencji dla wszystkich miejsc przechowywania danych osobowych. Wartości 30/90 dni oraz wcześniejsze „konto + 1 rok” należy traktować jako cele polityki, a nie dowód kompletnego egzekwowania. Przed pilotem wymagana jest tabela: typ danych → miejsce przechowywania → okres → mechanizm usunięcia lub anonimizacji → test.

## 5. DPIA i stan przed pilotem
Platformowa ocena skutków jest prowadzona w [DPIA_PLATFORM_CURRENT.md](./DPIA_PLATFORM_CURRENT.md). Do czasu zamknięcia wskazanych tam kwestii prawnych i istniejącego technicznego gate T58 dokument ma status PRE-PRODUCTION, a nie „pełna zgodność produkcyjna”.
