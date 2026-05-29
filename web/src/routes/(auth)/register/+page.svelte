<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { ui } from '$lib/stores/ui';
	import { Button } from '$lib/components/ui';
	import { Input } from '$lib/components/ui';
	import { PasswordInput } from '$lib/components/ui';
	import { Card } from '$lib/components/ui';
	import { isValidEmail, minLength } from '$lib/utils/validators';

	let username = $state('');
	let email = $state('');
	let password = $state('');
	let password2 = $state('');
	let name = $state('');
	let city = $state('');
	let termsAccepted = $state(false);
	let loading = $state(false);
	let error = $state('');

	onMount(() => {
		if (auth.isAuthenticated) {
			goto('/dashboard');
		}
	});

	function passwordStrength(pw: string): { score: number; label: string; color: string } {
		let score = 0;
		if (pw.length >= 8) score++;
		if (pw.length >= 12) score++;
		if (/[A-Z]/.test(pw)) score++;
		if (/[0-9]/.test(pw)) score++;
		if (/[^A-Za-z0-9]/.test(pw)) score++;

		if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' };
		if (score <= 3) return { score, label: 'Fair', color: 'bg-amber-500' };
		if (score <= 4) return { score, label: 'Good', color: 'bg-blue-500' };
		return { score, label: 'Strong', color: 'bg-green-500' };
	}

	function validate(): string | null {
		if (!username.trim()) return 'Username is required';
		if (!email.trim()) return 'Email is required';
		if (!isValidEmail(email)) return 'Invalid email format';
		if (!password) return 'Password is required';
		if (password.length < 8) return 'Password must be at least 8 characters';
		if (password !== password2) return 'Passwords do not match';
		if (!name.trim()) return 'Name is required';
		if (!city.trim()) return 'City is required';
		if (!termsAccepted) return 'You must accept the terms';
		return null;
	}

	async function handleRegister(e: Event) {
		e.preventDefault();
		error = '';

		const validationError = validate();
		if (validationError) {
			error = validationError;
			return;
		}

		loading = true;
		try {
			await auth.register({ username: username.trim(), email: email.trim(), password, password2, name: name.trim(), city: city.trim() });
			await auth.login(username, password);
			ui.addToast('Account created successfully', 'success');
			goto('/dashboard');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Registration failed';
		} finally {
			loading = false;
		}
	}
</script>

<Card>
	<section class="p-8">
		<div class="mb-8 text-center">
			<h1 class="text-3xl font-bold text-[#F5E6CC]">4VELO</h1>
			<p class="mt-2 text-sm text-[#B0A090]">Create your account</p>
		</div>

		<form onsubmit={handleRegister} class="space-y-4">
			{#if error}
				<div class="rounded border border-red-500 bg-red-900/20 px-4 py-2 text-sm text-red-400">{error}</div>
			{/if}

			<div>
				<label for="reg-username" class="mb-1 block text-sm text-[#B0A090]">Username</label>
				<Input id="reg-username" placeholder="Choose a username" bind:value={username} required />
			</div>

			<div>
				<label for="reg-email" class="mb-1 block text-sm text-[#B0A090]">Email</label>
				<Input id="reg-email" type="email" placeholder="you@example.com" bind:value={email} required />
			</div>

			<div>
				<label for="reg-name" class="mb-1 block text-sm text-[#B0A090]">Full Name</label>
				<Input id="reg-name" placeholder="Your full name" bind:value={name} required />
			</div>

			<div>
				<label for="reg-city" class="mb-1 block text-sm text-[#B0A090]">City</label>
				<Input id="reg-city" placeholder="Your city" bind:value={city} required />
			</div>

			<div>
				<label for="reg-password" class="mb-1 block text-sm text-[#B0A090]">Password</label>
				<PasswordInput id="reg-password" placeholder="Create a password" bind:value={password} required />
				{#if password}
					{@const strength = passwordStrength(password)}
					<div class="mt-1 flex items-center gap-2">
						<div class="flex-1 h-1.5 rounded-full bg-[#2B303A]">
							<div class="h-full rounded-full {strength.color} transition-all duration-300" style="width: {(strength.score / 5) * 100}%"></div>
						</div>
						<span class="text-xs text-[#A0A0A0]">{strength.label}</span>
					</div>
				{/if}
			</div>

			<div>
				<label for="reg-password2" class="mb-1 block text-sm text-[#B0A090]">Confirm Password</label>
				<PasswordInput id="reg-password2" placeholder="Confirm your password" bind:value={password2} required />
				{#if password2 && password !== password2}
					<p class="mt-1 text-xs text-red-400">Passwords do not match</p>
				{/if}
			</div>

			<label class="flex items-start gap-2 cursor-pointer">
				<input type="checkbox" bind:checked={termsAccepted} class="mt-0.5 rounded border-[#5C4020] bg-[#2B303A] accent-[#D4A373]" />
				<span class="text-sm text-[#B0A090]">
					I agree to the <a href="/terms" class="text-[#D4A373] hover:underline">Terms of Service</a> and <a href="/privacy" class="text-[#D4A373] hover:underline">Privacy Policy</a>
				</span>
			</label>

			<Button type="submit" variant="primary" size="lg" class="w-full" loading={loading}>
				Create Account
			</Button>
		</form>

		<p class="mt-6 text-center text-sm text-[#B0A090]">
			Already have an account?
			<a href="/login" class="text-[#D4A373] hover:underline">Sign in</a>
		</p>
	</section>
</Card>
