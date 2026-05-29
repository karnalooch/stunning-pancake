import axios from 'axios';

const client = axios.create({
	baseURL: '/api/',
	headers: { 'Content-Type': 'application/json' }
});

client.interceptors.request.use((config) => {
	const token = localStorage.getItem('auth_token');
	if (token && config.headers) {
		config.headers.Authorization = `Bearer ${token}`;
	}
	return config;
});

client.interceptors.response.use(
	(response) => response,
	async (error) => {
		const original = error.config;
		if (error.response?.status === 401 && !original._retry) {
			original._retry = true;
			const refresh = localStorage.getItem('auth_refresh_token');
			if (refresh) {
				try {
					const { data } = await axios.post('/api/auth/token/refresh/', { refresh });
					localStorage.setItem('auth_token', data.access);
					original.headers.Authorization = `Bearer ${data.access}`;
					return client(original);
				} catch {
					localStorage.removeItem('auth_token');
					localStorage.removeItem('auth_refresh_token');
					window.location.href = '/login';
				}
			}
		}
		return Promise.reject(error);
	}
);

export default client;
