<script lang="ts">
	import { auth } from '$lib/stores/auth';

	let { children }: { children: import('svelte').Snippet } = $props();

	let isReady = $derived(!auth.isLoading);
	let isAuthed = $derived(auth.isAuthenticated);
</script>

{#if isReady}
	{#if isAuthed}
		{@render children()}
	{:else}
		<script>
			import { goto } from '$app/navigation';
			goto('/login');
		</script>
	{/if}
{:else}
	<div class="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0B1D33] to-[#1A1410]">
		<div class="flex flex-col items-center gap-4">
			<svg class="animate-spin h-8 w-8 text-[#D4A373]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
			</svg>
			<p class="text-[#B0A090]">Loading...</p>
		</div>
	</div>
{/if}
