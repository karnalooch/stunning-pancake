import { apiGet, apiPost, apiPut, apiDelete } from './client';
import type { Club, ClubChallenge, PaginatedResponse } from '$shared/types';

export const clubsService = {
	async listClubs(params?: {
		page?: number;
		search?: string;
		sport_type?: string;
		ordering?: string;
	}): Promise<PaginatedResponse<Club>> {
		return apiGet<PaginatedResponse<Club>>('/api/clubs/', { params });
	},

	async getClub(id: number): Promise<Club> {
		return apiGet<Club>(`/api/clubs/${id}/`);
	},

	async createClub(data: {
		name: string;
		description?: string;
		sport_type?: string;
		logo?: File;
	}): Promise<Club> {
		if (data.logo) {
			const formData = new FormData();
			formData.append('name', data.name);
			if (data.description) formData.append('description', data.description);
			if (data.sport_type) formData.append('sport_type', data.sport_type);
			formData.append('logo', data.logo);
			return apiPost<Club>('/api/clubs/', formData, {
				headers: { 'Content-Type': 'multipart/form-data' }
			});
		}
		return apiPost<Club>('/api/clubs/', data);
	},

	async joinClub(clubId: number): Promise<void> {
		return apiPost(`/api/clubs/${clubId}/join/`);
	},

	async leaveClub(clubId: number): Promise<void> {
		return apiPost(`/api/clubs/${clubId}/leave/`);
	},

	async getMembers(clubId: number, params?: { page?: number }): Promise<PaginatedResponse<{
		id: number;
		username: string;
		avatar: string | null;
		role: string;
		total_km: number;
		joined_at: string;
	}>> {
		return apiGet(`/api/clubs/${clubId}/members/`, { params });
	},

	async getChallenges(clubId: number, params?: { page?: number; status?: string }): Promise<PaginatedResponse<ClubChallenge>> {
		return apiGet(`/api/clubs/${clubId}/challenges/`, { params });
	},

	async createChallenge(clubId: number, data: {
		title: string;
		sport_type: string;
		start_date: string;
		end_date: string;
		opponent_club?: number;
	}): Promise<ClubChallenge> {
		return apiPost(`/api/clubs/${clubId}/challenges/`, data);
	}
};
