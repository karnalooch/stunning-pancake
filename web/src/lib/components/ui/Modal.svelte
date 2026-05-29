<script lang="ts">
	import { cn } from '$lib/utils/cn';

	let { open = $bindable(false), class: className = '', children, ...rest }: { open?: boolean; class?: string; children: import('svelte').Snippet; [k: string]: unknown } = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') open = false;
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={() => (open = false)}
		onkeydown={handleKeydown}
	>
		<div class={cn('rounded-lg border border-[#5C4020] bg-[#3D3020] p-6 shadow-[6px_6px_0_0_#000000]', className)} onclick={(e) => e.stopPropagation()} onkeydown={() => {}} {...rest}>
			{@render children()}
		</div>
	</div>
{/if}
