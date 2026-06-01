/** Activity kind for live map markers (icons only — no position dots). */
export type LiveActivityKind = 'bike' | 'run';

export interface LiveMapPosition {
    deviceId: string;
    name: string;
    type: string;
    lat: number;
    lng: number;
    speed: number;
    course: number;
    lastUpdate: string;
}

const CYCLIST_TYPES = new Set(['bike', 'bicycle', 'cycling', 'cyclist']);
const RUNNER_TYPES = new Set(['run', 'running', 'runner', 'person', 'walk', 'walking', 'foot']);

export function resolveActivityKind(type: string | undefined): LiveActivityKind {
    const t = (type || '').toLowerCase();
    if (CYCLIST_TYPES.has(t)) return 'bike';
    if (RUNNER_TYPES.has(t)) return 'run';
    return 'bike';
}

export function speedToKmh(speed: number): number {
    if (!speed || speed <= 0) return 0;
    if (speed <= 12) return Math.round(speed * 3.6);
    return Math.round(speed * 1.852);
}

const BIKE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>`;

const RUN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16l2.5-1.5L9 18l2-6 3 2 3-5 2 1"/><circle cx="9" cy="6" r="2"/></svg>`;

const STYLES: Record<LiveActivityKind, { gradient: string; shadow: string }> = {
    bike: {
        gradient: 'linear-gradient(145deg, #4f46e5 0%, #7c3aed 55%, #a855f7 100%)',
        shadow: '0 4px 14px rgba(79, 70, 229, 0.45)',
    },
    run: {
        gradient: 'linear-gradient(145deg, #059669 0%, #10b981 55%, #34d399 100%)',
        shadow: '0 4px 14px rgba(16, 185, 129, 0.45)',
    },
};

export function createLiveUserMarkerElement(pos: LiveMapPosition): HTMLDivElement {
    const kind = resolveActivityKind(pos.type);
    const style = STYLES[kind];
    const speedKmh = speedToKmh(pos.speed);

    const root = document.createElement('div');
    root.className = 'live-user-marker';
    root.style.cssText = 'display:flex;flex-direction:column;align-items:center;pointer-events:none;';

    const label = document.createElement('div');
    label.style.cssText = [
        'display:flex;align-items:center;gap:6px',
        'padding:4px 8px;margin-bottom:4px',
        'background:rgba(24,24,27,0.92);color:#fff',
        'border-radius:6px;font-size:11px;font-weight:600',
        'white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.25)',
        'font-family:system-ui,-apple-system,sans-serif',
    ].join(';');

    const nameSpan = document.createElement('span');
    nameSpan.textContent = pos.name;

    const speedSpan = document.createElement('span');
    speedSpan.style.cssText = 'color:#4ade80;font-weight:700;font-variant-numeric:tabular-nums';
    speedSpan.textContent = speedKmh > 0 ? String(speedKmh) : '—';

    label.append(nameSpan, speedSpan);

    const icon = document.createElement('div');
    icon.setAttribute('data-activity', kind);
    icon.style.cssText = [
        'width:40px;height:40px;border-radius:50%',
        'display:flex;align-items:center;justify-content:center',
        `background:${style.gradient}`,
        `box-shadow:${style.shadow}`,
        'border:2px solid rgba(255,255,255,0.9)',
    ].join(';');
    icon.innerHTML = kind === 'bike' ? BIKE_SVG : RUN_SVG;

    root.append(label, icon);
    return root;
}

export function updateLiveUserMarkerElement(el: HTMLDivElement, pos: LiveMapPosition): void {
    const kind = resolveActivityKind(pos.type);
    const speedKmh = speedToKmh(pos.speed);
    const label = el.firstElementChild as HTMLDivElement | null;
    const icon = el.lastElementChild as HTMLDivElement | null;
    if (label) {
        const nameSpan = label.children[0] as HTMLSpanElement;
        const speedSpan = label.children[1] as HTMLSpanElement;
        if (nameSpan) nameSpan.textContent = pos.name;
        if (speedSpan) speedSpan.textContent = speedKmh > 0 ? String(speedKmh) : '—';
    }
    if (icon) {
        const prev = icon.getAttribute('data-activity');
        if (prev !== kind) {
            const style = STYLES[kind];
            icon.setAttribute('data-activity', kind);
            icon.style.background = style.gradient;
            icon.style.boxShadow = style.shadow;
            icon.innerHTML = kind === 'bike' ? BIKE_SVG : RUN_SVG;
        }
    }
}
