<script lang="ts">
	interface Props {
		username: string;
		size?: 'sm' | 'md' | 'lg';
	}

	let { username, size = 'md' }: Props = $props();

	const initials = username
		.split(/[\s_-]+/)
		.map((part) => part[0]?.toUpperCase() ?? '')
		.slice(0, 2)
		.join('');

	function getBgColor(name: string): string {
		const colors = ['#B0A090', '#5C4020', '#3D3428', '#2D2418', '#4A5568', '#744210', '#975A16', '#718096'];
		let hash = 0;
		for (let i = 0; i < name.length; i++) {
			hash = name.charCodeAt(i) + ((hash << 5) - hash);
		}
		return colors[Math.abs(hash) % colors.length];
	}

	const bg = getBgColor(username);

	const sizeClasses = {
		sm: 'h-8 w-8 text-xs',
		md: 'h-10 w-10 text-sm',
		lg: 'h-12 w-12 text-base'
	};
</script>

<span
	class="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-[#F5E6CC] {sizeClasses[size]}"
	style="background-color: {bg};"
>
	{initials}
</span>
