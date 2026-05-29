<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto('/dashboard');
	});
</script>
