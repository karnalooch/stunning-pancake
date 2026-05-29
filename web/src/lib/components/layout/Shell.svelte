<script lang="ts">
	let { children }: { children: import('svelte').Snippet } = $props();
</script>

<div class="flex min-h-screen flex-col">
	{@render children()}
</div>
