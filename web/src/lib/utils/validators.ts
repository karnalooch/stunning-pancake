export function isValidEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function minLength(value: string, min: number): boolean {
	return value.length >= min;
}

export function required(value: unknown): boolean {
	if (typeof value === 'string') return value.trim().length > 0;
	return value !== null && value !== undefined;
}

export function matches(value: string, other: string): boolean {
	return value === other;
}
