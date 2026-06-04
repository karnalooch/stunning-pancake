import { useAuth } from './useAuth';
import { isPlaywrightE2eSession } from './e2eEnv';

const E2E_OWNER = {
    id: 1,
    username: 'e2e-admin',
    role: 'GLOBAL_OWNER' as const,
    tenantId: null,
    tenantFlags: { has_heatmap_analytics: true },
    isImpersonated: false,
};

/** Inject GLOBAL_OWNER before route guards (Playwright + manual browser with VITE_E2E=1). */
export function applyPlaywrightE2eAuth(): void {
    useAuth.setState({
        isAuthenticated: true,
        user: E2E_OWNER,
        token: 'test-access-token',
        refreshToken: 'test-refresh-token',
        permissions: ['*'],
    });
    localStorage.setItem('access_token', 'test-access-token');
    localStorage.setItem('refresh_token', 'test-refresh-token');
}

export function redirectOffE2eUnauthorized(): void {
    const hash = window.location.hash || '';
    if (hash.includes('/unauthorized')) {
        window.location.hash = '#/owner/dashboard';
    }
}

if (typeof window !== 'undefined' && isPlaywrightE2eSession()) {
    applyPlaywrightE2eAuth();
    redirectOffE2eUnauthorized();
}
