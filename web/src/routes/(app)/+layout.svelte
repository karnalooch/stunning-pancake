<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { auth } from '$lib/stores/auth';
	import { Shell, Navbar, Sidebar, MobileDrawer } from '$lib/components/layout';
	import AuthGuard from '$lib/guards/AuthGuard.svelte';

	let { children } = $props();

	let loggingOut = $state(false);
	let sidebarCollapsed = $state(false);
	let mobileDrawerOpen = $state(false);

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

	function toggleMobileDrawer() {
		mobileDrawerOpen = !mobileDrawerOpen;
	}

	function toggleSidebar() {
		sidebarCollapsed = !sidebarCollapsed;
	}

	async function handleLogout() {
		loggingOut = true;
		await auth.logout();
		goto('/login');
		loggingOut = false;
	}
</script>

<AuthGuard>
	<Shell>
		<Navbar
			{title}
			onToggleDrawer={toggleMobileDrawer}
			onToggleSidebar={toggleSidebar}
		/>
		<MobileDrawer bind:open={mobileDrawerOpen} />
		<div class="flex flex-1 overflow-hidden">
			<Sidebar bind:collapsed={sidebarCollapsed} />
			<main class="flex-1 overflow-auto p-6">
				{@render children()}
			</main>
		</div>
	</Shell>
</AuthGuard>
