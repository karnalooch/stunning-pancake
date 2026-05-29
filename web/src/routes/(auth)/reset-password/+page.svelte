<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { authService } from '$lib/services/api/auth';
	import { ui } from '$lib/stores/ui';
	import { Button } from '$lib/components/ui';
	import { PasswordInput } from '$lib/components/ui';
	import { Card } from '$lib/components/ui';

	let tokenParam = $state('');
	let newPassword = $state('');
	let newPassword2 = $state('');
	let loading = $state(false);
	let error = $state('');
	let done = $state(false);

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		tokenParam = params.get('token') || '';
		if (!tokenParam) {
			error = 'Invalid or missing reset token.';
		}
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';

		if (!newPassword || newPassword.length < 8) {
			error = 'Password must be at least 8 characters';
			return;
		}
		if (newPassword !== newPassword2) {
			error = 'Passwords do not match';
			return;
		}

		loading = true;
		try {
			await authService.passwordResetConfirm({
				token: tokenParam,
				new_password: newPassword,
				new_password2: newPassword2
			});
			done = true;
			ui.addToast('Password reset successfully', 'success');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Password reset failed';
		} finally {
			loading = false;
		}
	}
</script>

<Card>
	<section class="p-8">
		<div class="mb-8 text-center">
			<h1 class="text-3xl font-bold text-[#F5E6CC]">Set New Password</h1>
			<p class="mt-2 text-sm text-[#B0A090]">
				{#if done}
					Your password has been reset.
				{:else}
					Choose a new password for your account.
				{/if}
			</p>
		</div>

		{#if done}
			<div class="text-center space-y-4">
				<Button variant="primary" onclick={() => goto('/login')}>Back to Login</Button>
			</div>
		{:else if tokenParam}
			<form onsubmit={handleSubmit} class="space-y-4">
				{#if error}
					<div class="rounded border border-red-500 bg-red-900/20 px-4 py-2 text-sm text-red-400">{error}</div>
				{/if}

				<div>
					<label for="new-password" class="mb-1 block text-sm text-[#B0A090]">New Password</label>
					<PasswordInput id="new-password" placeholder="New password" bind:value={newPassword} required />
				</div>

				<div>
					<label for="new-password2" class="mb-1 block text-sm text-[#B0A090]">Confirm New Password</label>
					<PasswordInput id="new-password2" placeholder="Confirm new password" bind:value={newPassword2} required />
					{#if newPassword2 && newPassword !== newPassword2}
						<p class="mt-1 text-xs text-red-400">Passwords do not match</p>
					{/if}
				</div>

				<Button type="submit" variant="primary" size="lg" class="w-full" loading={loading}>
					Reset Password
				</Button>
			</form>
		{/if}

		<p class="mt-6 text-center text-sm text-[#B0A090]">
			<a href="/login" class="text-[#D4A373] hover:underline">Back to login</a>
		</p>
	</section>
</Card>
