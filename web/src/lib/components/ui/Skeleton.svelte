<script lang="ts">
	import { cn } from '$lib/utils/cn';

	let { class: className = '', ...rest }: { class?: string; [k: string]: unknown } = $props();
</script>

<div class={cn('animate-pulse rounded bg-[#4A4A4A]', className)} {...rest}></div>
