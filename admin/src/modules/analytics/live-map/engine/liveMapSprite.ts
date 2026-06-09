/** Runtime sprite atlas for MapLibre symbol layers (bike / run / direction). */

const SIZE = 64;
const CHEVRON_SIZE = 32;

function drawRoundIcon(
    ctx: CanvasRenderingContext2D,
    kind: 'bike' | 'run',
): void {
    const g = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    if (kind === 'bike') {
        g.addColorStop(0, '#4f46e5');
        g.addColorStop(0.55, '#7c3aed');
        g.addColorStop(1, '#a855f7');
    } else {
        g.addColorStop(0, '#059669');
        g.addColorStop(0.55, '#10b981');
        g.addColorStop(1, '#34d399');
    }
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.strokeStyle = '#fff';
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (kind === 'bike') {
        ctx.beginPath();
        ctx.arc(46, 46, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(18, 46, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(28, 38);
        ctx.lineTo(36, 28);
        ctx.lineTo(48, 32);
        ctx.lineTo(52, 24);
        ctx.stroke();
    } else {
        ctx.beginPath();
        ctx.arc(32, 16, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(14, 48);
        ctx.lineTo(22, 42);
        ctx.lineTo(30, 48);
        ctx.lineTo(34, 34);
        ctx.lineTo(44, 40);
        ctx.lineTo(50, 28);
        ctx.stroke();
    }
}

/** White chevron on transparent — SDF-tinted via `icon-color` in MapLibre. */
function drawDirectionChevron(ctx: CanvasRenderingContext2D): void {
    ctx.clearRect(0, 0, CHEVRON_SIZE, CHEVRON_SIZE);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(7, 5);
    ctx.lineTo(25, CHEVRON_SIZE / 2);
    ctx.lineTo(7, CHEVRON_SIZE - 5);
    ctx.closePath();
    ctx.fill();
}

function iconImageData(kind: 'bike' | 'run'): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d unavailable');
    drawRoundIcon(ctx, kind);
    return ctx.getImageData(0, 0, SIZE, SIZE);
}

function directionChevronImageData(): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = CHEVRON_SIZE;
    canvas.height = CHEVRON_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d unavailable');
    drawDirectionChevron(ctx);
    return ctx.getImageData(0, 0, CHEVRON_SIZE, CHEVRON_SIZE);
}

export async function ensureLiveMapSprites(map: {
    hasImage: (id: string) => boolean;
    addImage: (id: string, data: ImageData, options?: { pixelRatio?: number; sdf?: boolean }) => void;
}): Promise<void> {
    const specs: Array<{ id: string; kind: 'bike' | 'run' }> = [
        { id: 'live-icon-bike', kind: 'bike' },
        { id: 'live-icon-run', kind: 'run' },
    ];
    for (const { id, kind } of specs) {
        if (map.hasImage(id)) continue;
        map.addImage(id, iconImageData(kind), { pixelRatio: 2 });
    }
    if (!map.hasImage('live-icon-direction')) {
        map.addImage('live-icon-direction', directionChevronImageData(), { pixelRatio: 2, sdf: true });
    }
}
