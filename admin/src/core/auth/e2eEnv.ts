export function isE2eMode(): boolean {
    const flag = import.meta.env.VITE_E2E;
    return flag === '1' || flag === 'true';
}

export function isPlaywrightE2eSession(): boolean {
    if (typeof window === 'undefined') return isE2eMode();
    if (isE2eMode()) return true;
    try {
        return sessionStorage.getItem('playwright-e2e') === '1';
    } catch {
        return false;
    }
}
