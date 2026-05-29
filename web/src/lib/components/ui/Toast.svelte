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
</script>

{#if visible}
	<div class={cn('fixed bottom-4 right-4 z-50 rounded-lg border px-4 py-3 shadow-lg', className)}>
		<span>{message}</span>
	</div>
{/if}
