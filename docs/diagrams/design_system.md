# DESIGN SYSTEM: Solar-Ready HD-2D

## 1. Fundamenty (Foundations)
- **Siatka**: 8px (Grid-based layout).
- **Kontrast**: Min. 12:1 dla trybu Solar.
- **Outline**: 1px czarny (`#000000`) wokół wszystkich spritów i tekstu HUD.

## 2. Paleta Kolorów (High-Noon Invectus)
| Nazwa | HEX | Rola |
| :--- | :--- | :--- |
| **Action Cyan** | `#00F0FF` | Interakcja, aktywne ślady |
| **Solar Yellow** | `#FFF200` | Ostrzeżenia, strefy tętna |
| **Void Black** | `#050505` | Tło wysokiego kontrastu |
| **Pure White** | `#FFFFFF` | Tekst główny |

## 3. Typografia
- **Kluczowe metryki**: `Titan-Pixel` (Custom HD-2D Font).
- **Interfejs pomocniczy**: `Inter` (Sans-serif).

## 4. User Flow: Start Sesji
1. **Home**: Kliknięcie "START SESSION" (Haptyka: Long Press).
2. **GPS Lock**: Animowany sprite GPS (HD-2D) szukający sygnału.
3. **Active HUD**: Przejście w tryb pełnoekranowy, blokada gestów nawigacyjnych.
4. **Solar Adaptation**: Jeśli czujnik wykryje >10k lux, podbij jasność tła do czystej czerni i zmień Cyan na neonowy.
