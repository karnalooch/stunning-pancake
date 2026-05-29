import { apiGet } from './client';
import type { LeaderboardEntry, PaginatedResponse } from '$shared/types';

export const leaderboardService = {
	async getGlobal(params?: {
		page?: number;
		period?: string;
		sport_type?: string;
	}): Promise<PaginatedResponse<LeaderboardEntry>> {
		return apiGet<PaginatedResponse<LeaderboardEntry>>('/api/activities/leaderboard/', { params });
	},

	async getCity(cityId: string, params?: {
		page?: number;
		sport_type?: string;
	}): Promise<PaginatedResponse<LeaderboardEntry>> {
		return apiGet<PaginatedResponse<LeaderboardEntry>>(`/api/activities/leaderboard/${cityId}/`, { params });
	},

	async getDepartment(departmentId: number, params?: {
		page?: number;
		sport_type?: string;
	}): Promise<PaginatedResponse<LeaderboardEntry>> {
		return apiGet<PaginatedResponse<LeaderboardEntry>>(`/api/activities/leaderboard/department/${departmentId}/`, { params });
	},

	async getMyRank(cityId: string): Promise<LeaderboardEntry & { total_participants: number }> {
		return apiGet(`/api/activities/leaderboard/${cityId}/me/`);
	}
};
