<script lang="ts">
	let { children } = $props();
</script>

<div class="flex min-h-screen">
	<main class="flex-1 p-6">
		{@render children()}
	</main>
</div>
