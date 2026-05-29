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

	let { collapsed = $bindable(false) }: { collapsed?: boolean } = $props();
</script>

<aside
	class="hidden h-full border-r border-[#5C4020] bg-[#2D2418] md:flex md:flex-col md:transition-all md:duration-200"
	class:w-64={!collapsed}
	class:w-16={collapsed}
>
	<nav class="flex flex-1 flex-col gap-2 p-3">
		{#each navItems as item}
			<a
				href={item.href}
				class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[#3D3428]"
				class:bg-[#3D3428]={$page.url.pathname === item.href}
				class:text-[#F5E6CC]={$page.url.pathname === item.href}
				class:text-[#B0A090]={$page.url.pathname !== item.href}
				title={collapsed ? item.label : undefined}
			>
				<span class="text-lg">{item.icon}</span>
				{#if !collapsed}
					<span>{item.label}</span>
				{/if}
			</a>
		{/each}
	</nav>
	<div class="border-t border-[#5C4020] p-3">
		<button
			onclick={() => (collapsed = !collapsed)}
			class="flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm text-[#B0A090] transition-colors hover:bg-[#3D3428] hover:text-[#F5E6CC]"
		>
			{#if collapsed}
				<span>▶</span>
			{:else}
				<span>◀</span>
			{/if}
		</button>
	</div>
</aside>
