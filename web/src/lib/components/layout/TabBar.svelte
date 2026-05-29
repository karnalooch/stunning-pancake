<script lang="ts">
	let { children }: { children: import('svelte').Snippet } = $props();
</script>

<nav class="flex items-center justify-around border-t border-[#D4A373] bg-[#0B1D33] py-2">
	{@render children()}
</nav>
