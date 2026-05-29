<script lang="ts">
	let { children } = $props();
</script>

<div class="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0B1D33] to-[#1A1410]">
	<div class="w-full max-w-md">
		{@render children()}
	</div>
</div>
