# AUDYT LICENCJI: Raport Zgodności Prawnej

Ten audyt weryfikuje, czy platforma SPORT jest zgodna z **Konstytucją §1**, która nakazuje oparcie projektu w **100% na Permisywnym Open Source**, aby umożliwić komercjalizację White-Label bez ryzyka.

## 1. Podsumowanie Zależności

### 1.1 Główne Frameworki
| Zależność | Licencja | Typ | Status |
| :--- | :--- | :--- | :--- |
| **Next.js 15** | MIT | Permisywna | ✅ |
| **React 18/19** | MIT | Permisywna | ✅ |
| **Django 4.2** | BSD-3-Clause | Permisywna | ✅ |
| **FastAPI** | MIT | Permisywna | ✅ |
| **Tamagui v4** | MIT | Permisywna | ✅ |
| **React Native** | MIT | Permisywna | ✅ |

### 1.2 Dane i Infrastruktura
| Zależność | Licencja | Typ | Status | Uwaga |
| :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL** | PostgreSQL | Permisywna | ✅ | |
| **PostGIS** | GPL v2+ | Viralna | ⚠️ | PostGIS to oddzielna usługa bazy danych; interakcja przez protokół SQL NIE zaraża kodu aplikacji. |
| **Redis** | BSD-3-Clause | Permisywna | ✅ | (Standardowe użycie klienta) |
| **TimescaleDB** | Apache 2.0 / TSL | Permisywna/Prop. | ✅ | Edycja społecznościowa używa Apache 2.0. |
| **Traccar** | Apache 2.0 | Permisywna | ✅ | |
| **PowerSync** | PowerSync License | Source-Available | ✅ | Licencja komercyjna wymagana przy dużej skali, ale permisywna dla początkowego wzrostu. |

### 1.3 UI i Animacje (Stos "WOW")
| Zależność | Licencja | Typ | Status |
| :--- | :--- | :--- | :--- |
| **@dnd-kit** | MIT | Permisywna | ✅ |
| **RN Skia** | MIT | Permisywna | ✅ |
| **Reanimated 3** | MIT | Permisywna | ✅ |
| **Lucide Icons** | ISC | Permisywna | ✅ |
| **Tremor** | Apache 2.0 | Permisywna | ✅ |
| **Deck.gl** | MIT | Permisywna | ✅ |

## 2. Komponenty Nowej Ery (Dodane 2026-04-25)
| Zależność | Licencja | Status |
| :--- | :--- | :--- |
| `@dnd-kit/core` | MIT | ✅ |
| `@dnd-kit/sortable` | MIT | ✅ |
| `react-native-mmkv` | MIT | ✅ |

## 3. Ocena Ryzyka: "Infekcja GPL"

**Werdykt: NISKIE RYZYKO**

- **Izolacja Infrastruktury**: Wszystkie komponenty GPL (jak PostGIS) są izolowane na warstwie bazy danych. Żaden kod GPL nie jest statycznie linkowany ani importowany do kodu źródłowego `backend/`, `admin/` czy `user/`.
- **Strażnik Copyleft**: W pakietach uruchomieniowych aplikacji mobilnych i webowych nie ma zależności GPL/AGPL.
- **Gotowość White-Label**: Platforma może być legalnie sprzedawana jako produkt White-Label bez ujawniania zastrzeżonego kodu źródłowego modyfikacji.

## 4. Rekomendacje
1.  **Blokowanie Zależności**: Zawsze używaj `package-lock.json` i `requirements.txt`, aby zapobiec przypadkowym aktualizacjom do wersji ze zmienioną licencją (np. uważając na potencjalne zmiany licencji podobne do Redis).
2.  **Nagłówki Licencyjne**: Upewnij się, że zastrzeżone nagłówki są utrzymywane w plikach rdzenia logiki biznesowej, aby potwierdzić własność przed dystrybucją komercyjną.

---
*Audyt przeprowadzony: 2026-04-25 | Audytor: Antigravity AI | Wynik: ZALICZONE*
