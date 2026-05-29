<script lang="ts">
	import { cn } from '$lib/utils/cn';

	let {
		src,
		alt = '',
		size = 'md',
		class: className = ''
	}: {
		src: string | null;
		alt?: string;
		size?: 'sm' | 'md' | 'lg';
		class?: string;
	} = $props();
</script>

<div class={cn('relative inline-flex items-center justify-center overflow-hidden rounded-full bg-[#4A4A4A]', className)}>
	{#if src}
		<img {src} {alt} class="h-full w-full object-cover" />
	{:else}
		<span class="text-[#C8B098]">{alt.charAt(0) || '?'}</span>
	{/if}
</div>
