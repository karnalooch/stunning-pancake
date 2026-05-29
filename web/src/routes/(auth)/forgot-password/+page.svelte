<script lang="ts">
	import { goto } from '$app/navigation';
	import { authService } from '$lib/services/api/auth';
	import { ui } from '$lib/stores/ui';
	import { Button } from '$lib/components/ui';
	import { Input } from '$lib/components/ui';
	import { Card } from '$lib/components/ui';
	import { isValidEmail } from '$lib/utils/validators';

	let email = $state('');
	let loading = $state(false);
	let error = $state('');
	let sent = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';

		if (!email.trim() || !isValidEmail(email)) {
			error = 'Please enter a valid email address';
			return;
		}

		loading = true;
		try {
			await authService.passwordReset(email.trim());
			sent = true;
			ui.addToast('Password reset email sent', 'success');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to send reset email';
		} finally {
			loading = false;
		}
	}
</script>

<Card>
	<section class="p-8">
		<div class="mb-8 text-center">
			<h1 class="text-3xl font-bold text-[#F5E6CC]">Reset Password</h1>
			<p class="mt-2 text-sm text-[#B0A090]">
				{#if sent}
					Check your email for a password reset link.
				{:else}
					Enter your email and we'll send you a reset link.
				{/if}
			</p>
		</div>

		{#if sent}
			<div class="text-center space-y-4">
				<Button variant="primary" onclick={() => goto('/login')}>Back to Login</Button>
			</div>
		{:else}
			<form onsubmit={handleSubmit} class="space-y-4">
				{#if error}
					<div class="rounded border border-red-500 bg-red-900/20 px-4 py-2 text-sm text-red-400">{error}</div>
				{/if}

				<div>
					<label for="email" class="mb-1 block text-sm text-[#B0A090]">Email</label>
					<Input id="email" type="email" placeholder="you@example.com" bind:value={email} required />
				</div>

				<Button type="submit" variant="primary" size="lg" class="w-full" loading={loading}>
					Send Reset Link
				</Button>
			</form>
		{/if}

		<p class="mt-6 text-center text-sm text-[#B0A090]">
			<a href="/login" class="text-[#D4A373] hover:underline">Back to login</a>
		</p>
	</section>
</Card>
