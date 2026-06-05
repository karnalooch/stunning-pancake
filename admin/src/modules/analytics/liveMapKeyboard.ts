export type LiveMapKeyboardActions = {
    zoomIn: () => void;
    zoomOut: () => void;
    fitBounds: () => void;
    toggleHeatmap: () => void;
    toggleDiagnostics: () => void;
    togglePresentation: () => void;
};

export function handleLiveMapKeyDown(
    e: KeyboardEvent,
    actions: LiveMapKeyboardActions,
    opts?: { enabled?: boolean },
): boolean {
    if (opts?.enabled === false) return false;
    const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return false;

    const key = e.key.toLowerCase();
    if (key === '+' || key === '=') {
        actions.zoomIn();
        return true;
    }
    if (key === '-') {
        actions.zoomOut();
        return true;
    }
    if (key === 'f') {
        actions.fitBounds();
        return true;
    }
    if (key === 'h') {
        actions.toggleHeatmap();
        return true;
    }
    if (key === 'd') {
        actions.toggleDiagnostics();
        return true;
    }
    if (key === 'p') {
        actions.togglePresentation();
        return true;
    }
    return false;
}
