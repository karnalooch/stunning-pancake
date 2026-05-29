<script lang="ts">
	let { children }: { children: import('svelte').Snippet } = $props();
</script>

<div class="flex flex-col gap-2">
	{@render children()}
</div>
