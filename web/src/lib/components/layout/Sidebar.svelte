<script lang="ts">
	let { collapsed = $bindable(false), children }: { collapsed?: boolean; children: import('svelte').Snippet } = $props();
</script>

<aside class="h-full w-64 border-r border-[#5C4020] bg-[#2D2418] p-4">
	<nav>
		{@render children()}
	</nav>
</aside>
