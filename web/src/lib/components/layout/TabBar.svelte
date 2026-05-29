<script lang="ts">
	import { page } from '$app/stores';

	interface NavItem {
		label: string;
		href: string;
		icon: string;
	}

	const navItems: NavItem[] = [
		{ label: 'Dashboard', href: '/dashboard', icon: '📊' },
		{ label: 'Activities', href: '/activities', icon: '🚴' },
		{ label: 'Leaderboard', href: '/leaderboard', icon: '🏆' },
		{ label: 'Events', href: '/events', icon: '📅' },
		{ label: 'Clubs', href: '/clubs', icon: '👥' }
	];

	function isActive(path: string): boolean {
		return $page.url.pathname === path;
	}
</script>

<nav class="fixed bottom-0 left-0 right-0 z-40 border-t border-[#5C4020] bg-[#1A1A2E] md:hidden">
	<div class="flex items-center justify-around">
		{#each navItems as item}
			<a
				href={item.href}
				class="flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors"
				class:text-[#F5E6CC]={isActive(item.href)}
				class:text-[#B0A090]={!isActive(item.href)}
			>
				<span class="text-lg">{item.icon}</span>
				<span>{item.label}</span>
			</a>
		{/each}
	</div>
</nav>
