import { apiGet, apiPost, clearAuthTokens } from './client';
import type { UserProfile } from '$shared/types';

export const authService = {
	async login(username: string, password: string): Promise<{ access: string; refresh: string }> {
		return apiPost<{ access: string; refresh: string }>('/api/auth/token/', { username, password });
	},

	async register(userData: {
		username: string;
		email: string;
		password: string;
		password2?: string;
		tenant_id?: string;
		name?: string;
		city?: string;
		bio?: string;
	}): Promise<UserProfile> {
		return apiPost<UserProfile>('/api/users/register/', userData);
	},

	async logout(): Promise<void> {
		await apiPost('/api/auth/logout/');
		clearAuthTokens();
	},

	async refreshToken(refresh: string): Promise<{ access: string }> {
		return apiPost<{ access: string }>('/api/auth/token/refresh/', { refresh });
	},

	async verifyToken(token: string): Promise<void> {
		await apiPost('/api/auth/token/verify/', { token });
	},

	async googleAuth(): Promise<{ auth_url: string }> {
		return apiGet<{ auth_url: string }>('/api/auth/google/login/');
	},

	async facebookAuth(): Promise<{ auth_url: string }> {
		return apiGet<{ auth_url: string }>('/api/auth/facebook/login/');
	},

	async passwordChange(data: { old_password: string; new_password: string; new_password2: string }): Promise<void> {
		await apiPost('/api/users/password/change/', data);
	},

	async passwordReset(email: string): Promise<void> {
		await apiPost('/api/users/password/reset/', { email });
	},

	async passwordResetConfirm(data: { token: string; new_password: string; new_password2: string }): Promise<void> {
		await apiPost('/api/users/password/reset/confirm/', data);
	}
};


