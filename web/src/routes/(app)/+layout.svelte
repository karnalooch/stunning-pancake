<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { auth } from '$lib/stores/auth';
	import { Navbar } from '$lib/components/layout';
	import { Button } from '$lib/components/ui';
	import AuthGuard from '$lib/guards/AuthGuard.svelte';

	let { children } = $props();

	let loggingOut = $state(false);

	const routeTitles: Record<string, string> = {
		'/dashboard': 'Dashboard',
		'/activities': 'Activities',
		'/leaderboard': 'Leaderboard',
		'/events': 'Events',
		'/clubs': 'Clubs',
		'/rewards': 'Rewards',
		'/profile': 'Profile',
		'/admin': 'Admin Panel'
	};

	let title = $derived(routeTitles[$page.url.pathname] || '');

	async function handleLogout() {
		loggingOut = true;
		await auth.logout();
		goto('/login');
		loggingOut = false;
	}
</script>

<AuthGuard>
	<div class="flex min-h-screen flex-col bg-[#1A1A2E]">
		<Navbar {title}>
			<div class="flex items-center gap-3">
				<a href="/profile" class="text-sm text-[#B0A090] hover:text-[#F5E6CC] transition-colors">
					{auth.user?.username || 'Profile'}
				</a>
				<Button variant="ghost" size="sm" onclick={handleLogout} loading={loggingOut}>
					Logout
				</Button>
			</div>
		</Navbar>
		<main class="flex-1 p-6">
			{@render children()}
		</main>
	</div>
</AuthGuard>
