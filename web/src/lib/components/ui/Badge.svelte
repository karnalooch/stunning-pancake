<script lang="ts">
	import { cn } from '$lib/utils/cn';

	let { variant = 'default', class: className = '', children, ...rest }: { variant?: 'default' | 'success' | 'warning' | 'error' | 'info'; class?: string; children: import('svelte').Snippet; [k: string]: unknown } = $props();
</script>

<span class={cn('inline-flex items-center rounded px-2 py-0.5 text-xs font-medium', className)} {...rest}>
	{@render children()}
</span>
