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

<button class={cn('rounded font-medium transition-colors', variantStyles[variant], sizeStyles[size], className)} {...rest}>
	{@render children()}
</button>
