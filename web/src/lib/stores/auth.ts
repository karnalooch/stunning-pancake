let token = $state<string | null>(null);
let refreshToken = $state<string | null>(null);
let user = $state<import('$shared/types').UserProfile | null>(null);
let isAuthenticated = $state(false);
let isLoading = $state(true);

function initAuth() {
	const storedToken = localStorage.getItem('auth_token');
	const storedRefresh = localStorage.getItem('auth_refresh_token');
	if (storedToken) {
		token = storedToken;
		refreshToken = storedRefresh;
		isAuthenticated = true;
	}
	isLoading = false;
}

function login(access: string, refresh: string) {
	token = access;
	refreshToken = refresh;
	isAuthenticated = true;
	localStorage.setItem('auth_token', access);
	localStorage.setItem('auth_refresh_token', refresh);
}

function logout() {
	token = null;
	refreshToken = null;
	isAuthenticated = false;
	user = null;
	localStorage.removeItem('auth_token');
	localStorage.removeItem('auth_refresh_token');
}

export function getAuthStore() {
	return {
		get token() { return token; },
		get refreshToken() { return refreshToken; },
		get user() { return user; },
		get isAuthenticated() { return isAuthenticated; },
		get isLoading() { return isLoading; },
		setUser(u: typeof user) { user = u; },
		initAuth,
		login,
		logout
	};
}
