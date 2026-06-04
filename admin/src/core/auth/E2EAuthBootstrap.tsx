import { useEffect } from 'react';
import { isPlaywrightE2eSession } from './e2eEnv';
import { applyPlaywrightE2eAuth, redirectOffE2eUnauthorized } from './e2eAuthSession';

/** Playwright: inject GLOBAL_OWNER session (`VITE_E2E=1` or sessionStorage flag). */
export function E2EAuthBootstrap() {
    useEffect(() => {
        if (!isPlaywrightE2eSession()) return;
        applyPlaywrightE2eAuth();
        redirectOffE2eUnauthorized();
    }, []);

    if (!isPlaywrightE2eSession()) return null;
    return <div data-testid="e2e-auth-ready" style={{ display: 'none' }} aria-hidden />;
}
