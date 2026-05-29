<script lang="ts">
	import { page } from '$app/stores';
	import { slide } from 'svelte/transition';

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
		{ label: 'Clubs', href: '/clubs', icon: '👥' },
		{ label: 'Rewards', href: '/rewards', icon: '🎁' },
		{ label: 'Profile', href: '/profile', icon: '👤' },
		{ label: 'Admin Panel', href: '/admin', icon: '⚙️' }
	];

	let { open = $bindable(false) }: { open?: boolean } = $props();

	function close() {
		open = false;
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-40 bg-black/50 md:hidden"
		onclick={close}
		transition:slide={{ axis: 'x', duration: 200 }}
	></div>
	<aside
		class="fixed inset-y-0 left-0 z-50 w-64 border-r border-[#5C4020] bg-[#2D2418] md:hidden"
		transition:slide={{ axis: 'x', duration: 200 }}
	>
		<div class="flex h-14 items-center justify-between border-b border-[#5C4020] px-4">
			<span class="text-lg font-bold text-[#F5E6CC]">Navigation</span>
			<button onclick={close} class="text-[#B0A090] hover:text-[#F5E6CC]">✕</button>
		</div>
		<nav class="flex flex-col gap-2 p-3">
			{#each navItems as item}
				<a
					href={item.href}
					onclick={close}
					class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[#3D3428]"
					class:bg-[#3D3428]={$page.url.pathname === item.href}
					class:text-[#F5E6CC]={$page.url.pathname === item.href}
					class:text-[#B0A090]={$page.url.pathname !== item.href}
				>
					<span class="text-lg">{item.icon}</span>
					<span>{item.label}</span>
				</a>
			{/each}
		</nav>
	</aside>
{/if}
