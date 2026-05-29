import axios, { AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import type { PaginatedResponse } from '$shared/types';

const client = axios.create({
	baseURL: '/api/',
	headers: { 'Content-Type': 'application/json' },
	timeout: 15_000
});

client.interceptors.request.use((config) => {
	const token = localStorage.getItem('auth_token');
	if (token && config.headers) {
		config.headers.Authorization = `Bearer ${token}`;
	}
	return config;
});

let _refreshToken: string | null = null;
let _onForceLogout: (() => void) | null = null;

client.interceptors.response.use(
	(res: AxiosResponse) => {
		const body = res.data;
		if (body && typeof body === 'object' && 'ok' in body && 'data' in body) {
			return { ...res, data: body.data } as AxiosResponse;
		}
		return res;
	},
	async (error: AxiosError<{ error?: string; detail?: string; message?: string }>) => {
		const original = error.config as AxiosRequestConfig & { _retry?: boolean };

		if (error.response?.status === 401 && !original._retry) {
			const refresh = _refreshToken || localStorage.getItem('auth_refresh_token');
			if (refresh) {
				original._retry = true;
				try {
					const { data } = await axios.post('/api/auth/token/refresh/', { refresh });
					const access = data.access || data.data?.access;
					if (access) {
						localStorage.setItem('auth_token', access);
						if (original.headers) {
							original.headers.Authorization = `Bearer ${access}`;
						}
						return client(original);
					}
				} catch {
					// refresh failed — clear auth and force logout
				}
			}
		}

		if (error.response?.status === 401) {
			_refreshToken = null;
			localStorage.removeItem('auth_token');
			localStorage.removeItem('auth_refresh_token');
			_onForceLogout?.();
		}

		const msg = extractErrorMessage(error);
		return Promise.reject(new Error(msg));
	}
);

function extractErrorMessage(error: AxiosError<{ error?: string; detail?: string; message?: string }>): string {
	const data = error.response?.data;
	if (!data) return error.message || 'Network error';

	if (typeof data === 'string') return data;
	if (data.detail) return data.detail;
	if (data.error) return data.error;
	if (data.message) return data.message;

	const errors = Object.values(data as Record<string, unknown>);
	const first = errors[0];
	if (Array.isArray(first) && first.length > 0) return String(first[0]);
	if (typeof first === 'string') return first;

	return error.message || 'Request failed';
}

export { client as default, client as apiClient };

export function setAuthToken(token: string | null) {
	if (token) {
		client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
	} else {
		delete client.defaults.headers.common['Authorization'];
	}
}

export function setRefreshToken(refresh: string | null) {
	_refreshToken = refresh;
}

export function setAuthTokens(access: string, refresh: string) {
	setAuthToken(access);
	setRefreshToken(refresh);
}

export function clearAuthTokens() {
	delete client.defaults.headers.common['Authorization'];
	_refreshToken = null;
}

export function onForceLogout(cb: () => void) {
	_onForceLogout = cb;
}

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
	const res = await client.get<T>(url, config);
	return res.data;
}

export async function apiPost<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
	const res = await client.post<T>(url, data, config);
	return res.data;
}

export async function apiPut<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
	const res = await client.put<T>(url, data, config);
	return res.data;
}

export async function apiPatch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
	const res = await client.patch<T>(url, data, config);
	return res.data;
}

export async function apiDelete<T = void>(url: string, config?: AxiosRequestConfig): Promise<T> {
	const res = await client.delete<T>(url, config);
	return res.data;
}

export async function apiUpload<T>(url: string, formData: FormData, config?: AxiosRequestConfig): Promise<T> {
	const res = await client.post<T>(url, formData, {
		...config,
		headers: { ...config?.headers }
	});
	return res.data;
}

export async function apiGetPaginated<T>(url: string, config?: AxiosRequestConfig): Promise<PaginatedResponse<T>> {
	const res = await client.get<PaginatedResponse<T>>(url, config);
	return res.data;
}

export type { AxiosRequestConfig, AxiosResponse };
