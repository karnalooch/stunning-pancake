let sidebarOpen = $state(false);
let theme = $state<'light' | 'dark' | 'system'>('dark');
let toasts: Array<{ id: number; message: string; type: 'success' | 'error' | 'warning' | 'info' }> = $state([]);

let toastId = 0;

function toggleSidebar() {
	sidebarOpen = !sidebarOpen;
}

function setTheme(t: typeof theme) {
	theme = t;
}

function addToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
	const id = ++toastId;
	toasts = [...toasts, { id, message, type }];
	setTimeout(() => {
		toasts = toasts.filter((t) => t.id !== id);
	}, 4000);
}

export function getUIStore() {
	return {
		get sidebarOpen() { return sidebarOpen; },
		get theme() { return theme; },
		get toasts() { return toasts; },
		toggleSidebar,
		setTheme,
		addToast
	};
}

export const ui = getUIStore();
