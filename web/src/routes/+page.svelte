<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth';

	onMount(() => {
		if (auth.isAuthenticated) {
			goto('/dashboard');
		}
	});
</script>

<h1 class="text-center text-[#B0A090]">Redirecting...</h1>
