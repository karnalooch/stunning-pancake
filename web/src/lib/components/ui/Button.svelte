<script lang="ts">
	import { cn } from '$lib/utils/cn';

	let {
		variant = 'primary',
		size = 'md',
		class: className = '',
		children,
		...rest
	}: {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'sm' | 'md' | 'lg';
		class?: string;
		children: import('svelte').Snippet;
		[k: string]: unknown;
	} = $props();
</script>

<button class={cn('rounded px-4 py-2 font-medium transition-colors', className)} {...rest}>
	{@render children()}
</button>
