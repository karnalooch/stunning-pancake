import { apiGet, apiPost } from './client';
import type { RewardBalance, RewardPool, PaginatedResponse } from '$shared/types';

export const rewardsService = {
	async getBalance(): Promise<RewardBalance> {
		return apiGet<RewardBalance>('/api/rewards/balance/');
	},

	async getPools(params?: { page?: number; available?: boolean }): Promise<PaginatedResponse<RewardPool>> {
		return apiGet<PaginatedResponse<RewardPool>>('/api/rewards/pools/', { params });
	},

	async redeem(poolId: number): Promise<{
		voucher_code: string;
		voucher_url: string;
		expires_at: string;
	}> {
		return apiPost(`/api/rewards/redeem/${poolId}/`);
	},

	async getSponsorStats(params?: { sponsor_id?: string }): Promise<{
		total_rewards_issued: number;
		total_points_redeemed: number;
		active_pools: number;
	}> {
		return apiGet('/api/rewards/sponsor-stats/', { params });
	},

	async getTransactionHistory(params?: { page?: number }): Promise<PaginatedResponse<{
		id: number;
		amount: number;
		description: string;
		created_at: string;
	}>> {
		return apiGet('/api/rewards/transactions/', { params });
	}
};
