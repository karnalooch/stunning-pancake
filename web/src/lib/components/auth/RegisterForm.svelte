<script lang="ts">
	let { children }: { children: import('svelte').Snippet } = $props();
</script>

<form onsubmit={(e) => e.preventDefault()} class="space-y-4">
	{@render children()}
</form>
