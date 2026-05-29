<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { setAuthToken, setAuthTokens } from '$lib/services/api/client';

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		const accessToken = params.get('access_token');
		const refreshToken = params.get('refresh_token');

		if (accessToken) {
			localStorage.setItem('auth_token', accessToken);
			if (refreshToken) {
				localStorage.setItem('auth_refresh_token', refreshToken);
				setAuthTokens(accessToken, refreshToken);
			} else {
				setAuthToken(accessToken);
			}

			auth.setUser(null);
			auth.initAuth().then(() => {
				goto('/dashboard');
			});
		} else {
			goto('/login');
		}
	});
</script>

<div class="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0B1D33] to-[#1A1410]">
	<div class="text-center">
		<svg class="animate-spin h-10 w-10 mx-auto text-[#D4A373]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
			<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
		</svg>
		<p class="mt-4 text-[#B0A090]">Completing sign in...</p>
	</div>
</div>
