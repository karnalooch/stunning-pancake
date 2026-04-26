# SYSTEM PROJEKTANTA: Stos Technologiczny Live Hyper-Edit

Niniejszy dokument opisuje technologie i wzorce architektoniczne umożliwiające funkcje „Live Hyper-Edit” (projektant w locie) w całej platformie SPORT.

## 1. Dashboard Web i Admin (Next.js / Vite)

Projektant oparty na przeglądarce umożliwia orkiestrację układu i modyfikację treści w czasie rzeczywistym bezpośrednio w przeglądarce.

### Kluczowe technologie
- **[@dnd-kit](https://dndkit.com/)**: Lekki, modułowy zestaw narzędzi drag-and-drop dla React. Obsługuje logikę zmiany kolejności układu dla widżetów dashboardu i kart KPI.
- **HTML5 `contentEditable`**: Wykorzystywany do wysokowydajnej edycji tekstu inline. Pozwala na modyfikację węzłów DOM bez narzutu ciężkich komponentów formularzy.
- **React Context API (`DesignerProvider`)**: Działa jako globalny koordynator stanu „Trybu Projektowania”. Przełącza interaktywność w całej bibliotece komponentów atomowych.
- **LocalStorage**: Zapewnia natychmiastową trwałość po stronie klienta. Manifesty układu i mapowania treści są serializowane i przechowywane lokalnie, aby pominąć opóźnienia sieciowe w fazie projektowania.

### Wzorzec implementacji
```tsx
// Przykład orkiestracji projektanta
<DesignerProvider>
  <DndContext onDragEnd={handleDragEnd}>
    <SortableContext items={layout}>
      <DraggableWidget id="stats-1">
        <EditableText id="title" defaultText="Total Users" />
      </DraggableWidget>
    </SortableContext>
  </DndContext>
</DesignerProvider>
```

---

## 2. Aplikacja Mobilna (Android / iOS)

Projektant mobilny skupia się na personalizacji HUD (Heads-Up Display) dla aktywnych sesji sportowych.

### Kluczowe technologie
- **[react-native-mmkv](https://github.com/mrousavy/react-native-mmkv)**: Główna warstwa trwałości. MMKV to wysokowydajny magazyn klucz-wartość napisany w C++, zapewniający synchroniczny dostęp do konfiguracji UI.
- **Tamagui v4**: Silnik UI używany do „Designer Bottom Sheet” i kontrolek dostosowywania. Jego optymalizujący kompilator zapewnia, że narzędzia projektowe mają zerowy narzut w czasie wykonywania.
- **Natywne obsługa gestów**: Wykorzystuje `onLongPress` jako punkt wejścia do trybu projektanta, zapewniając dostępność narzędzi edycyjnych bez zakłócania standardowych kontrolek sesji.

### Przepływ danych
1. **Wyzwalacz**: Długie naciśnięcie nagłówka sesji.
2. **Interakcja**: Użytkownik przełącza widoczność metryk za pomocą modala opartego na Tamagui.
3. **Trwałość**: `DesignerService` zapisuje nową konfigurację `HudMetric[]` do MMKV.
4. **Reaktywność**: Interfejs użytkownika ponownie renderuje siatkę statystyk w oparciu o zaktualizowany manifest MMKV.

---

## 3. Podsumowanie Kanonu Technicznego

| Warstwa | Strategia Web | Strategia Mobilna |
| :--- | :--- | :--- |
| **Silnik DND** | `@dnd-kit/sortable` | Ręczna logika zmiany kolejności siatki |
| **Edycja** | `contentEditable` | Przełączniki oparte na modalach |
| **Trwałość** | `window.localStorage` | `react-native-mmkv` |
| **Stan** | React Context | Legend-State (Planowane) |

---
*Status: ARCHITEKTURA ZWERYFIKOWANA | Wersja: 1.0.0*
