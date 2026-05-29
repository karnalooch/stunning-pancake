<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { ui } from '$lib/stores/ui';
	import { Button } from '$lib/components/ui';
	import { Input } from '$lib/components/ui';
	import { PasswordInput } from '$lib/components/ui';
	import { Card } from '$lib/components/ui';
	import { isValidEmail } from '$lib/utils/validators';

	let username = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');

	onMount(() => {
		if (auth.isAuthenticated) {
			goto('/dashboard');
		}
	});

	async function handleLogin(e: Event) {
		e.preventDefault();
		error = '';

		if (!username.trim()) {
			error = 'Username is required';
			return;
		}
		if (!password) {
			error = 'Password is required';
			return;
		}

		loading = true;
		try {
			await auth.login(username, password);
			ui.addToast('Login successful', 'success');
			goto('/dashboard');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Invalid credentials';
		} finally {
			loading = false;
		}
	}

	async function handleGoogleAuth() {
		try {
			const { authService } = await import('$lib/services/api/auth');
			const { auth_url } = await authService.googleAuth();
			window.location.href = auth_url;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to initiate Google login';
		}
	}

	async function handleFacebookAuth() {
		try {
			const { authService } = await import('$lib/services/api/auth');
			const { auth_url } = await authService.facebookAuth();
			window.location.href = auth_url;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to initiate Facebook login';
		}
	}
</script>

<Card>
	<section class="p-8">
		<div class="mb-8 text-center">
			<h1 class="text-3xl font-bold text-[#F5E6CC]">4VELO</h1>
			<p class="mt-2 text-sm text-[#B0A090]">Sign in to your account</p>
		</div>

		<form onsubmit={handleLogin} class="space-y-4">
			{#if error}
				<div class="rounded border border-red-500 bg-red-900/20 px-4 py-2 text-sm text-red-400">{error}</div>
			{/if}

			<div>
				<label for="username" class="mb-1 block text-sm text-[#B0A090]">Username</label>
				<Input id="username" placeholder="Enter your username" bind:value={username} required />
			</div>

			<div>
				<label for="password" class="mb-1 block text-sm text-[#B0A090]">Password</label>
				<PasswordInput id="password" placeholder="Enter your password" bind:value={password} required />
			</div>

			<div class="text-right">
				<a href="/forgot-password" class="text-sm text-[#D4A373] hover:underline">Forgot password?</a>
			</div>

			<Button type="submit" variant="primary" size="lg" class="w-full" loading={loading}>
				Sign In
			</Button>
		</form>

		<div class="my-6 flex items-center gap-4">
			<hr class="flex-1 border-[#5C4020]" />
			<span class="text-xs text-[#807060]">OR</span>
			<hr class="flex-1 border-[#5C4020]" />
		</div>

		<div class="flex flex-col gap-3">
			<button
				type="button"
				class="flex w-full items-center justify-center gap-2 rounded border border-[#5C4020] bg-[#2B303A] px-4 py-2 text-[#F5E6CC] hover:bg-[#3A404A] transition-colors"
				onclick={handleGoogleAuth}
			>
				<svg class="h-5 w-5" viewBox="0 0 24 24">
					<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
					<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
					<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
					<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
				</svg>
				Continue with Google
			</button>

			<button
				type="button"
				class="flex w-full items-center justify-center gap-2 rounded border border-[#5C4020] bg-[#2B303A] px-4 py-2 text-[#F5E6CC] hover:bg-[#3A404A] transition-colors"
				onclick={handleFacebookAuth}
			>
				<svg class="h-5 w-5" viewBox="0 0 24 24" fill="#1877F2">
					<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
				</svg>
				Continue with Facebook
			</button>
		</div>

		<p class="mt-6 text-center text-sm text-[#B0A090]">
			Don't have an account?
			<a href="/register" class="text-[#D4A373] hover:underline">Create one</a>
		</p>
	</section>
</Card>
