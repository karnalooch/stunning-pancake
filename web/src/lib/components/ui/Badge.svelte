<script lang="ts">
	import { cn } from '$lib/utils/cn';

	let { variant = 'default', class: className = '', children, ...rest }: { variant?: 'default' | 'success' | 'warning' | 'error' | 'info'; class?: string; children: import('svelte').Snippet; [k: string]: unknown } = $props();

	const variantStyles: Record<string, string> = {
		default: 'bg-[#4A4A4A] text-[#F5E6CC]',
		success: 'bg-green-700 text-white',
		warning: 'bg-amber-700 text-white',
		error: 'bg-red-700 text-white',
		info: 'bg-blue-700 text-white'
	};
</script>

<span class={cn('inline-flex items-center rounded px-2 py-0.5 text-xs font-medium', variantStyles[variant], className)} {...rest}>
	{@render children()}
</span>
