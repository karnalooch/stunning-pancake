/**
 * Wipe PROD local Postgres (not sim-lab proxy). Requires force_local in body.
 *
 *   ADMIN_PASS='***' node scripts/wipe-prod-local.mjs
 */
const API = process.env.PROD_API || 'https://backend-production-55c7.up.railway.app/api';
const USER = process.env.ADMIN_USER || 'global_owner';
const PASS = process.env.ADMIN_PASS || '';
const PHRASE = 'DELETE ALL DATA — PRODUCTION — GLOBAL_OWNER';
const POLL_MS = 15000;
const TIMEOUT_MIN = 180;

async function login() {
    const r = await fetch(`${API}/auth/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: USER, password: PASS }),
    });
    if (!r.ok) throw new Error(`login ${r.status}`);
    return (await r.json()).access;
}

async function api(method, path, token, body) {
    const r = await fetch(`${API}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(120000),
    });
    const data = await r.json().catch(() => ({}));
    return { status: r.status, data };
}

async function main() {
    if (!PASS) {
        console.error('ADMIN_PASS required');
        process.exit(1);
    }
    const token = await login();
    console.log('Stopping live/batch sim on prod local…');
    await api('DELETE', '/activities/admin/live-simulate/?local=1', token);
    await api('DELETE', '/activities/admin/simulate/?local=1', token).catch(() => {});

    const wipeBody = {
        confirm: true,
        confirm_phrase: PHRASE,
        mfa_confirmed: true,
        force: true,
        force_local: true,
    };
    console.log('Starting PROD LOCAL wipe (force_local=true)…');
    const start = await api('DELETE', '/activities/admin/wipe-data/', token, wipeBody);
    console.log(start.status, start.data.message || start.data.phase || start.data.error);

    const deadline = Date.now() + TIMEOUT_MIN * 60 * 1000;
    while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const { data: ws } = await api('GET', '/activities/admin/wipe-data/?local=1', token);
        console.log(
            `[${new Date().toISOString().slice(11, 19)}] phase=${ws.phase} ${ws.progress_pct}% running=${ws.running} rows=${ws.rows_deleted} proxy=${ws.sim_lab_proxy ?? false}`,
        );
        if (ws.error) throw new Error(ws.error);
        if (!ws.running && ws.phase === 'complete') {
            const stats = await api('GET', '/activities/admin/stats/?refresh=1', token);
            console.log('Done. PROD stats:', {
                users: stats.data.total_users,
                activities: stats.data.total_activities,
            });
            return;
        }
    }
    throw new Error('Wipe timeout');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
