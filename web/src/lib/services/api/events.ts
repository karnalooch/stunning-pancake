import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from './client';
import type { Event, PaginatedResponse } from '$shared/types';

export const eventsService = {
	async listEvents(params?: {
		page?: number;
		event_type?: string;
		status?: string;
		search?: string;
	}): Promise<PaginatedResponse<Event>> {
		return apiGet<PaginatedResponse<Event>>('/api/events/', { params });
	},

	async getEvent(id: number): Promise<Event> {
		return apiGet<Event>(`/api/events/${id}/`);
	},

	async createEvent(data: {
		title: string;
		description?: string;
		event_type: string;
		sport_filter?: string;
		start_date: string;
		end_date: string;
		require_brouter_validation?: boolean;
		boundary?: Record<string, unknown>;
		opponent_tenant_id?: number;
		club?: number;
		opponent_club?: number;
	}): Promise<Event> {
		return apiPost<Event>('/api/events/', data);
	},

	async updateEvent(id: number, data: Partial<{
		title: string;
		description: string;
		sport_filter: string;
		start_date: string;
		end_date: string;
		require_brouter_validation: boolean;
		boundary: Record<string, unknown>;
	}>): Promise<Event> {
		return apiPut<Event>(`/api/events/${id}/`, data);
	},

	async deleteEvent(id: number): Promise<void> {
		return apiDelete(`/api/events/${id}/`);
	},

	async getParticipations(eventId: number, params?: { page?: number }): Promise<PaginatedResponse<{
		id: number;
		user_id: number;
		username: string;
		total_distance: number;
		score: number;
		rank: number;
	}>> {
		return apiGet(`/api/events/${eventId}/participations/`, { params });
	},

	async joinEvent(eventId: number): Promise<void> {
		return apiPost(`/api/events/${eventId}/join/`);
	},

	async leaveEvent(eventId: number): Promise<void> {
		return apiPost(`/api/events/${eventId}/leave/`);
	}
};
