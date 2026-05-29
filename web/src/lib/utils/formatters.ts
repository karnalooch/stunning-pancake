export function formatDistance(km: number): string {
	return `${(+km).toFixed(1)} km`;
}

export function formatDuration(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = Math.floor(minutes % 60);
	if (h > 0) return `${h}h ${m}m`;
	return `${m}m`;
}

export function formatPace(km: number, minutes: number): string {
	if (km <= 0) return '--:-- /km';
	const pace = minutes / km;
	const pMin = Math.floor(pace);
	const pSec = Math.floor((pace - pMin) * 60);
	return `${pMin}:${pSec.toString().padStart(2, '0')} /km`;
}

export function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
}

export function formatShortDate(iso: string): string {
	return new Date(iso).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric'
	});
}
