<script lang="ts">
	import { cn } from '$lib/utils/cn';

	let {
		message = '',
		type = 'info',
		visible = $bindable(false),
		class: className = ''
	}: {
		message?: string;
		type?: 'success' | 'error' | 'warning' | 'info';
		visible?: boolean;
		class?: string;
	} = $props();

	const typeStyles: Record<string, string> = {
		success: 'border-green-500 bg-green-900 text-green-100',
		error: 'border-red-500 bg-red-900 text-red-100',
		warning: 'border-amber-500 bg-amber-900 text-amber-100',
		info: 'border-blue-500 bg-blue-900 text-blue-100'
	};
</script>

{#if visible}
	<div class={cn('fixed bottom-4 right-4 z-50 rounded-lg border px-4 py-3 shadow-lg', typeStyles[type], className)}>
		<span>{message}</span>
	</div>
{/if}
