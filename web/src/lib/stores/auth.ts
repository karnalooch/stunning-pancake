import { onForceLogout, setAuthTokens } from '$lib/services/api/client';
import { authService } from '$lib/services/api/auth';
import { usersService } from '$lib/services/api/users';
import type { UserProfile } from '$shared/types';

let token = $state<string | null>(null);
let refreshToken = $state<string | null>(null);
let user = $state<UserProfile | null>(null);
let isAuthenticated = $state(false);
let isLoading = $state(true);
let initPromise: Promise<void> | null = null;

async function initAuth() {
	if (initPromise) return initPromise;

	initPromise = (async () => {
		const storedToken = localStorage.getItem('auth_token');
		const storedRefresh = localStorage.getItem('auth_refresh_token');

		if (!storedToken) {
			isLoading = false;
			return;
		}

		token = storedToken;
		if (storedRefresh) refreshToken = storedRefresh;
		setAuthTokens(storedToken, storedRefresh || '');

		try {
			await authService.verifyToken(storedToken);
			const profile = await usersService.getProfile();
			user = profile;
			isAuthenticated = true;
		} catch {
			localStorage.removeItem('auth_token');
			localStorage.removeItem('auth_refresh_token');
			token = null;
			refreshToken = null;
			user = null;
			isAuthenticated = false;
		} finally {
			isLoading = false;
		}
	})();

	return initPromise;
}

async function login(username: string, password: string) {
	const data = await authService.login(username, password);
	token = data.access;
	refreshToken = data.refresh;
	isAuthenticated = true;
	localStorage.setItem('auth_token', data.access);
	localStorage.setItem('auth_refresh_token', data.refresh);
	setAuthTokens(data.access, data.refresh);

	try {
		const profile = await usersService.getProfile();
		user = profile;
	} catch {
		// user profile fetch failed but login succeeded
	}
}

async function register(userData: {
	username: string;
	email: string;
	password: string;
	password2: string;
	name?: string;
	city?: string;
}) {
	const created = await authService.register(userData);
	user = created;
	return created;
}

async function refreshAuthToken() {
	const currentRefresh = refreshToken || localStorage.getItem('auth_refresh_token');
	if (!currentRefresh) return;

	try {
		const data = await authService.refreshToken(currentRefresh);
		token = data.access;
		localStorage.setItem('auth_token', data.access);
	} catch {
		await forceLogout();
	}
}

async function logout() {
	try {
		await authService.logout();
	} catch {
		// logout API call failing shouldn't block client-side cleanup
	}
	forceLogout();
}

function forceLogout() {
	token = null;
	refreshToken = null;
	isAuthenticated = false;
	user = null;
	localStorage.removeItem('auth_token');
	localStorage.removeItem('auth_refresh_token');
}

function setUser(u: UserProfile | null) {
	user = u;
}

export function getAuthStore() {
	return {
		get token() { return token; },
		get refreshToken() { return refreshToken; },
		get user() { return user; },
		get isAuthenticated() { return isAuthenticated; },
		get isLoading() { return isLoading; },
		setUser,
		initAuth,
		login,
		register,
		refreshAuthToken,
		logout
	};
}

export const auth = getAuthStore();

onForceLogout(() => {
	forceLogout();
});
