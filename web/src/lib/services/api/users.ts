import { apiGet, apiPut, apiPatch, apiUpload, apiGetPaginated } from './client';
import type { UserProfile, Tenant, Department, PaginatedResponse } from '$shared/types';

export const usersService = {
	async getProfile(): Promise<UserProfile> {
		return apiGet<UserProfile>('/api/users/profile/');
	},

	async updateProfile(data: Partial<UserProfile> & { avatar?: never }): Promise<UserProfile> {
		return apiPut<UserProfile>('/api/users/profile/', data);
	},

	async uploadAvatar(file: File): Promise<{ avatar: string }> {
		const formData = new FormData();
		formData.append('avatar', file);
		return apiUpload<{ avatar: string }>('/api/users/profile/', formData);
	},

	async getTenants(): Promise<Tenant[]> {
		return apiGet<Tenant[]>('/api/users/tenants/');
	},

	async getBranding(): Promise<{ primary_color: string; secondary_color: string; logo: string | null }> {
		return apiGet('/api/users/branding/');
	},

	async updateBranding(tenantId: number, data: {
		primary_color?: string;
		secondary_color?: string;
		logo?: File;
	}): Promise<void> {
		if (data.logo) {
			const formData = new FormData();
			if (data.primary_color) formData.append('primary_color', data.primary_color);
			if (data.secondary_color) formData.append('secondary_color', data.secondary_color);
			formData.append('logo', data.logo);
			await apiUpload(`/api/users/branding/${tenantId}/update/`, formData);
		} else {
			await apiPatch(`/api/users/branding/${tenantId}/update/`, data);
		}
	},

	async getDepartments(): Promise<Department[]> {
		return apiGet<Department[]>('/api/users/departments/');
	},

	async getAuditLog(params?: { page?: number; user_id?: number }): Promise<PaginatedResponse<{
		id: number;
		user_id: number;
		action: string;
		timestamp: string;
		details: string;
	}>> {
		return apiGetPaginated('/api/users/audit-log/', { params });
	}
};
