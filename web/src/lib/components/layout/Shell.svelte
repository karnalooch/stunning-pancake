<script lang="ts">
	let { children }: { children: import('svelte').Snippet } = $props();
</script>

<div class="flex min-h-screen flex-col bg-[#1A1A2E]">
	{@render children()}
</div>
