/** Runtime sprite atlas for MapLibre symbol layers (bike / run). */

const SIZE = 72;

function drawRoundIcon(
    ctx: CanvasRenderingContext2D,
    kind: 'bike' | 'run',
): void {
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const r = SIZE / 2 - 3;

    // Dark outer ring for contrast on light Positron basemap
    ctx.beginPath();
    ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.fill();

    const g = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    if (kind === 'bike') {
        g.addColorStop(0, '#4338ca');
        g.addColorStop(0.5, '#6d28d9');
        g.addColorStop(1, '#9333ea');
    } else {
        g.addColorStop(0, '#047857');
        g.addColorStop(0.5, '#059669');
        g.addColorStop(1, '#10b981');
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.98)';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.strokeStyle = '#fff';
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const scale = SIZE / 64;
    ctx.save();
    ctx.translate((SIZE - 64 * scale) / 2, (SIZE - 64 * scale) / 2);
    ctx.scale(scale, scale);

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
    ctx.restore();
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

export async function ensureLiveMapSprites(map: {
    hasImage: (id: string) => boolean;
    addImage: (id: string, data: ImageData, options?: { pixelRatio?: number }) => void;
}): Promise<void> {
    const specs: Array<{ id: string; kind: 'bike' | 'run' }> = [
        { id: 'live-icon-bike', kind: 'bike' },
        { id: 'live-icon-run', kind: 'run' },
    ];
    for (const { id, kind } of specs) {
        if (map.hasImage(id)) continue;
        map.addImage(id, iconImageData(kind), { pixelRatio: 2 });
    }
}
