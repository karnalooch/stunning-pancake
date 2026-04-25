# DESIGNER SYSTEM: Live Hyper-Edit Technology Stack

This document outlines the technologies and architectural patterns enabling the "Live Hyper-Edit" (In-Flight Designer) features across the SPORT platform.

## 1. Web & Admin Dashboard (Next.js / Vite)

The web-based designer allows real-time layout orchestration and content modification directly in the browser.

### Core Technologies
- **[@dnd-kit](https://dndkit.com/)**: A lightweight, modular drag-and-drop toolkit for React. It handles the layout reordering logic for dashboard widgets and KPI cards.
- **HTML5 `contentEditable`**: Leveraged for high-performance inline text editing. It allows modifying DOM nodes without the overhead of heavy form components.
- **React Context API (`DesignerProvider`)**: Acts as the global orchestrator for "Design Mode" state. It toggles interactivity across the atomic component library.
- **LocalStorage**: Provides instantaneous client-side persistence. Layout manifests and content mappings are serialized and stored locally to bypass network latency during the design phase.

### Implementation Pattern
```tsx
// Example of the Designer Orchestration
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

## 2. Mobile App (Android / iOS)

The mobile designer focuses on HUD (Heads-Up Display) personalization for active sports sessions.

### Core Technologies
- **[react-native-mmkv](https://github.com/mrousavy/react-native-mmkv)**: The primary persistence layer. MMKV is a high-performance key-value storage written in C++, providing synchronous access to UI configurations.
- **Tamagui v4**: The UI engine used for the "Designer Bottom Sheet" and customization controls. Its optimizing compiler ensures that the design tools have zero runtime overhead.
- **Native Gesture Handlers**: Utilizes `onLongPress` as the entry point for the designer mode, ensuring the editing tools are accessible but don't interfere with standard session controls.

### Data Flow
1. **Trigger**: Long-press on the session header.
2. **Interaction**: User toggles metric visibility via the Tamagui-based modal.
3. **Persistence**: `DesignerService` writes the new `HudMetric[]` config to MMKV.
4. **Reactivity**: The UI re-renders the stats grid based on the updated MMKV manifest.

---

## 3. Tech Canon Summary

| Layer | Web Strategy | Mobile Strategy |
|:---|:---|:---|
| **DND Engine** | `@dnd-kit/sortable` | Manual grid-reordering logic |
| **Editing** | `contentEditable` | Modal-based toggles |
| **Persistence** | `window.localStorage` | `react-native-mmkv` |
| **State** | React Context | Legend-State (Planned) |

---
*Status: ARCHITECTURE VERIFIED | Version: 1.0.0*
