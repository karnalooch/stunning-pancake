import { apiGet, apiPost } from './client';

export const wearablesService = {
	async stravaAuth(): Promise<{ auth_url: string }> {
		return apiGet<{ auth_url: string }>('/api/activities/wearables/strava/auth/');
	},

	async garminAuth(): Promise<{ auth_url: string }> {
		return apiGet<{ auth_url: string }>('/api/activities/wearables/garmin/auth/');
	},

	async syncWearables(): Promise<{
		strava: { connected: boolean; last_sync: string | null };
		garmin: { connected: boolean; last_sync: string | null };
		synced_count: number;
	}> {
		return apiPost('/api/activities/wearables/sync/');
	},

	async getWearableStatus(): Promise<{
		strava: { connected: boolean; last_sync: string | null };
		garmin: { connected: boolean; last_sync: string | null };
	}> {
		return apiGet('/api/activities/wearables/status/');
	},

	async disconnectStrava(): Promise<void> {
		return apiPost('/api/activities/wearables/strava/disconnect/');
	},

	async disconnectGarmin(): Promise<void> {
		return apiPost('/api/activities/wearables/garmin/disconnect/');
	}
};
