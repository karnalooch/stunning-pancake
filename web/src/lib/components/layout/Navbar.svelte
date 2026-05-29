<script lang="ts">
	let { title = '', children }: { title?: string; children: import('svelte').Snippet } = $props();
</script>

<header class="flex h-14 items-center justify-between border-b border-[#5C4020] bg-[#2D2418] px-4">
	<h1 class="text-lg font-bold">{title}</h1>
	{@render children()}
</header>
