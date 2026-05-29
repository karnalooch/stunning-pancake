<script lang="ts">
	import { cn } from '$lib/utils/cn';

	let { class: className = '', children, ...rest }: { class?: string; children: import('svelte').Snippet; [k: string]: unknown } = $props();
</script>

<div class={cn('rounded-lg border border-[#5C4020] bg-[#3D3020] p-6 shadow-[6px_6px_0_0_#000000]', className)} {...rest}>
	{@render children()}
</div>
