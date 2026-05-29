<script lang="ts">
	import { cn } from '$lib/utils/cn';

	let {
		placeholder = '',
		class: className = '',
		value = $bindable(''),
		...rest
	}: {
		placeholder?: string;
		class?: string;
		value?: string;
		[k: string]: unknown;
	} = $props();

	let showPassword = $state(false);
</script>

<div class="relative">
	<input
		type={showPassword ? 'text' : 'password'}
		{placeholder}
		bind:value
		class={cn(
			'w-full rounded border border-[#5C4020] bg-[#2B303A] px-3 py-2 pr-10 text-[#F5E6CC] placeholder:text-[#A0A0A0] focus:border-[#D4A373] focus:outline-none',
			className
		)}
		{...rest}
	/>
	<button
		type="button"
		class="absolute inset-y-0 right-0 flex items-center px-3 text-[#A0A0A0] hover:text-[#F5E6CC]"
		onclick={() => (showPassword = !showPassword)}
		aria-label={showPassword ? 'Hide password' : 'Show password'}
	>
		{#if showPassword}
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243 3 3 0 01-4.243-4.243zM12 5c4.478 0 8.268 2.943 9.543 7a9.97 9.97 0 01-1.563 3.029m-5.858.908a3 3 0 01-4.243-4.243" />
			</svg>
		{:else}
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
				<path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
			</svg>
		{/if}
	</button>
</div>
