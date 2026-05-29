<script lang="ts">
	import { cn } from '$lib/utils/cn';

	let {
		type = 'text',
		placeholder = '',
		class: className = '',
		value = $bindable(''),
		...rest
	}: {
		type?: string;
		placeholder?: string;
		class?: string;
		value?: string;
		[k: string]: unknown;
	} = $props();
</script>

<input
	type={type}
	{placeholder}
	bind:value
	class={cn(
		'w-full rounded border border-[#5C4020] bg-[#2B303A] px-3 py-2 text-[#F5E6CC] placeholder:text-[#A0A0A0] focus:border-[#D4A373] focus:outline-none',
		className
	)}
	{...rest}
/>
