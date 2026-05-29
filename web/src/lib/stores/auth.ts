import { writable, get } from 'svelte/store';

type AuthUser = { username: string; avatar?: string } | null;

interface AuthState {
	user: AuthUser;
	token: string | null;
}

const store = writable<AuthState>({ user: null, token: null });

export const auth = Object.assign(store, {
	async login(credentials: { username: string; password: string }) {
		store.set({
			user: { username: credentials.username },
			token: `token-${credentials.username}`
		});
	},

	async logout() {
		store.set({ user: null, token: null });
	},

	hasPermission(_permission: string): boolean {
		const state = get(store);
		return !!state.user;
	}
});
