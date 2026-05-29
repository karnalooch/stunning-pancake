<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { Avatar } from '$lib/components/ui';

	interface Props {
		title?: string;
		onToggleDrawer?: () => void;
		onToggleSidebar?: () => void;
	}

	let { title = '', onToggleDrawer, onToggleSidebar }: Props = $props();

	async function handleLogout() {
		await auth.logout();
		window.location.href = '/login';
	}
</script>

<header class="flex h-14 items-center justify-between border-b border-[#5C4020] bg-[#2D2418] px-4">
	<div class="flex items-center gap-3">
		<button
			onclick={onToggleDrawer}
			class="flex items-center justify-center rounded-lg p-1 text-[#B0A090] hover:bg-[#3D3428] hover:text-[#F5E6CC] md:hidden"
		>
			<span class="text-xl">☰</span>
		</button>
		<button
			onclick={onToggleSidebar}
			class="hidden items-center justify-center rounded-lg p-1 text-[#B0A090] hover:bg-[#3D3428] hover:text-[#F5E6CC] md:flex"
		>
			<span class="text-xl">☰</span>
		</button>
		<h1 class="text-lg font-bold text-[#F5E6CC]">{title}</h1>
	</div>
	<div class="flex items-center gap-3">
		<a href="/profile" class="flex items-center gap-2 text-sm text-[#B0A090] hover:text-[#F5E6CC] transition-colors">
			{#if auth.user?.username}
				<Avatar username={auth.user.username} size="sm" />
				<span class="hidden sm:inline">{auth.user.username}</span>
			{:else}
				<span>Profile</span>
			{/if}
		</a>
		<button
			onclick={handleLogout}
			class="rounded-lg px-3 py-1.5 text-sm text-[#B0A090] transition-colors hover:bg-[#3D3428] hover:text-[#F5E6CC]"
		>
			Logout
		</button>
	</div>
</header>
