<script lang="ts">
	import { cn } from '$lib/utils/cn';

	let {
		variant = 'primary',
		size = 'md',
		loading = false,
		class: className = '',
		children,
		...rest
	}: {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'sm' | 'md' | 'lg';
		loading?: boolean;
		class?: string;
		children: import('svelte').Snippet;
		[k: string]: unknown;
	} = $props();

	const variantStyles: Record<string, string> = {
		primary: 'bg-[#D4A373] text-[#1A1A2E] hover:bg-[#C8956A]',
		secondary: 'bg-[#5C4020] text-[#F5E6CC] hover:bg-[#6B4F30]',
		ghost: 'bg-transparent text-[#F5E6CC] hover:bg-[#4A4A4A]',
		danger: 'bg-red-700 text-white hover:bg-red-800'
	};

	const sizeStyles: Record<string, string> = {
		sm: 'px-3 py-1 text-sm',
		md: 'px-4 py-2 text-base',
		lg: 'px-6 py-3 text-lg'
	};
</script>

<button class={cn('rounded font-medium transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed', variantStyles[variant], sizeStyles[size], className)} disabled={loading} {...rest}>
	{#if loading}
		<svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
			<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
		</svg>
	{/if}
	{@render children()}
</button>
