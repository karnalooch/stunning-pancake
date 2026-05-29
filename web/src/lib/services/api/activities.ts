import { apiGet, apiPost, apiPut, apiDelete } from './client';
import type { ActivityItem, ActivityDetail, POI, PaginatedResponse } from '$shared/types';

export const activitiesService = {
	async listSessions(params?: {
		page?: number;
		type?: string;
		start_date?: string;
		end_date?: string;
		ordering?: string;
	}): Promise<PaginatedResponse<ActivityItem>> {
		return apiGet<PaginatedResponse<ActivityItem>>('/api/activities/sessions/', { params });
	},

	async getSession(id: number): Promise<ActivityDetail> {
		return apiGet<ActivityDetail>(`/api/activities/sessions/${id}/`);
	},

	async createSession(data: {
		type: string;
		start_time: string;
		end_time: string;
		distance: number;
		duration?: number;
		route_path?: Record<string, unknown>;
		route_coords?: Array<[number, number]>;
	}): Promise<ActivityDetail> {
		return apiPost<ActivityDetail>('/api/activities/sessions/', data);
	},

	async updateSession(id: number, data: Partial<{
		type: string;
		start_time: string;
		end_time: string;
		distance: number;
		duration: number;
		route_path: Record<string, unknown>;
		route_coords: Array<[number, number]>;
	}>): Promise<ActivityDetail> {
		return apiPut<ActivityDetail>(`/api/activities/sessions/${id}/`, data);
	},

	async deleteSession(id: number): Promise<void> {
		return apiDelete(`/api/activities/sessions/${id}/`);
	},

	async approveActivity(id: number): Promise<void> {
		return apiPost(`/api/activities/sessions/${id}/approve/`);
	},

	async rejectActivity(id: number, reason?: string): Promise<void> {
		return apiPost(`/api/activities/sessions/${id}/reject/`, { reason });
	},

	async getStats(params?: { period?: string; tenant_id?: string }): Promise<{
		total_activities: number;
		total_distance: number;
		total_duration: number;
		avg_speed: number;
		type_breakdown: Record<string, number>;
	}> {
		return apiGet('/api/activities/admin/stats/', { params });
	},

	async redeemVoucher(poolId: number): Promise<{
		voucher_code: string;
		voucher_url: string;
		expires_at: string;
	}> {
		return apiPost(`/api/rewards/redeem/${poolId}/`);
	},

	async getPOIs(params?: { category?: string; tenant_id?: string }): Promise<POI[]> {
		return apiGet<POI[]>('/api/activities/pois/', { params });
	}
};
