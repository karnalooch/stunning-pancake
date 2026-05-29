<script lang="ts">
	let { collapsed = $bindable(false), children }: { collapsed?: boolean; children: import('svelte').Snippet } = $props();
</script>

<aside class="h-full border-r border-[#5C4020] bg-[#2D2418] p-4 transition-all duration-200" class:w-64={!collapsed} class:w-16={collapsed}>
	<nav>
		{@render children()}
	</nav>
</aside>
