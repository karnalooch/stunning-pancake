<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { getAuthStore } from '$lib/stores/auth';

	let { children } = $props();

	const auth = getAuthStore();

	onMount(() => {
		auth.initAuth();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
