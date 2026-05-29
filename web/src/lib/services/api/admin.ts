import { apiGet, apiPost, apiPut, apiDelete } from './client';
import type { UserProfile, PaginatedResponse } from '$shared/types';

export const adminService = {
	async getAllUsers(params?: {
		page?: number;
		role?: string;
		tenant_id?: string;
		search?: string;
		is_active?: boolean;
	}): Promise<PaginatedResponse<UserProfile>> {
		return apiGet<PaginatedResponse<UserProfile>>('/api/users/all/', { params });
	},

	async createUser(data: {
		username: string;
		email: string;
		password: string;
		role?: string;
		tenant_id?: string;
	}): Promise<UserProfile> {
		return apiPost<UserProfile>('/api/users/create/', data);
	},

	async updateUser(userId: number, data: {
		username?: string;
		email?: string;
		role?: string;
		tenant_id?: string;
		is_active?: boolean;
	}): Promise<UserProfile> {
		return apiPut<UserProfile>(`/api/users/${userId}/update/`, data);
	},

	async deleteUser(userId: number): Promise<void> {
		return apiDelete(`/api/users/${userId}/delete/`);
	},

	async impersonateUser(userId: number): Promise<{ access: string; refresh: string }> {
		return apiPost(`/api/users/impersonate/${userId}/`);
	},

	async manageUsers(userId: number, action: 'activate' | 'deactivate' | 'role_update', data?: Record<string, unknown>): Promise<UserProfile> {
		return apiPost(`/api/users/${userId}/manage/`, { action, ...data });
	},

	async getPendingActivities(params?: { page?: number }): Promise<PaginatedResponse<{
		id: number;
		type: string;
		user_id: number;
		username: string;
		distance: number;
		duration: number;
		start_time: string;
		verification_score: number;
	}>> {
		return apiGet('/api/activities/admin/all/', {
			params: { ...params, status: 'pending' }
		});
	},

	async wipeData(scope: 'all' | 'activities' | 'users' | 'events' | 'rewards'): Promise<void> {
		return apiPost('/api/activities/admin/wipe-data/', { scope });
	},

	async simulate(params: {
		count: number;
		type?: string;
		start_date?: string;
		end_date?: string;
	}): Promise<{ created: number; errors: string[] }> {
		return apiPost('/api/activities/admin/simulate/', params);
	},

	async liveSimulate(): Promise<{ status: string }> {
		return apiPost('/api/activities/admin/live-simulate/');
	},

	async getWorkerStatus(): Promise<{
		celery_workers: { name: string; status: string; processed: number }[];
		queue_length: number;
	}> {
		return apiGet('/api/activities/admin/worker-status/');
	},

	async recalculateLeaderboard(): Promise<void> {
		return apiPost('/api/activities/leaderboard/admin/recalculate/');
	},

	async exportData(resource: string): Promise<Blob> {
		const response = await apiGet<Blob>(`/api/activities/export/${resource}/`, {
			responseType: 'blob'
		} as never);
		return response;
	},

	async getFeatureFlags(): Promise<Record<string, boolean>> {
		return apiGet('/api/settings/flags/');
	},

	async setFeatureFlag(flag: string, enabled: boolean): Promise<void> {
		return apiPost('/api/settings/flags/', { flag, enabled });
	}
};
