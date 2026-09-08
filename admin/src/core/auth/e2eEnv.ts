export function isE2eMode(): boolean {
    const flag = import.meta.env.VITE_E2E;
    return flag === '1' || flag === 'true';
}

export function isPlaywrightE2eSession(): boolean {
    if (typeof window === 'undefined') return isE2eMode();
    try {
        const sessionFlag = sessionStorage.getItem('playwright-e2e');
        if (sessionFlag === '0') return false;
        if (sessionFlag === '1') return true;
    } catch {
        // Fall back to the build-time flag when session storage is unavailable.
    }
    return isE2eMode();
}
