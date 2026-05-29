<script lang="ts">
	let { class: className = '', children }: { class?: string; children: import('svelte').Snippet } = $props();
</script>

<div class={className}>
	{@render children()}
</div>
