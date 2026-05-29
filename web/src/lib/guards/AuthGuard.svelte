<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { auth } from '$lib/stores/auth';

	let { children }: { children: Snippet } = $props();

	$effect(() => {
		if (!$auth.user) {
			goto('/login');
		}
	});
</script>

{@render children()}
