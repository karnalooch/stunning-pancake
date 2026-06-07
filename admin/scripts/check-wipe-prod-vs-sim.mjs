/**
 * Compare wipe/stats on prod API vs sim-lab backend directly.
 */
const PROD = process.env.PROD_API || 'https://backend-production-55c7.up.railway.app/api';
const SIM = process.env.SIM_API || 'https://backend-production-80cf.up.railway.app/api';
const USER = process.env.ADMIN_USER || 'global_owner';
const PASS = process.env.ADMIN_PASS || '';

async function token(base) {
    const r = await fetch(`${base}/auth/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: USER, password: PASS }),
    });
    if (!r.ok) throw new Error(`login ${base} ${r.status}`);
    return (await r.json()).access;
}

async function get(base, access, path) {
    const t0 = Date.now();
    const r = await fetch(`${base}${path}`, {
        headers: { Authorization: `Bearer ${access}` },
        signal: AbortSignal.timeout(120000),
    });
    let data;
    const text = await r.text();
    try {
        data = JSON.parse(text);
    } catch {
        data = { _raw: text.slice(0, 200) };
    }
    return { status: r.status, ms: Date.now() - t0, data };
}

async function main() {
    if (!PASS) {
        console.error('ADMIN_PASS required');
        process.exit(1);
    }
    const paths = [
        '/activities/admin/stats/',
        '/activities/admin/scale-preflight/?target_users=1000&skip_activities=true',
        '/activities/admin/wipe-data/',
    ];

    for (const [label, base] of [['PROD', PROD], ['SIM-LAB', SIM]]) {
        console.log(`\n######## ${label} (${base}) ########`);
        try {
            const access = await token(base);
            for (const path of paths) {
                const { status, ms, data } = await get(base, access, path);
                console.log(`\n${path} → ${status} (${ms}ms)`);
                if (path.includes('stats')) {
                    console.log({
                        total_users: data.total_users,
                        total_activities: data.total_activities,
                        stale: data.stale,
                        sim_lab_proxy: data.sim_lab_proxy,
                    });
                } else if (path.includes('preflight')) {
                    console.log({
                        athletes_in_db: data.athletes_in_db,
                        sim_lab_proxy: data.sim_lab_proxy,
                    });
                } else {
                    console.log({
                        phase: data.phase,
                        running: data.running,
                        progress_pct: data.progress_pct,
                        rows_deleted: data.rows_deleted,
                        deleted: data.deleted,
                        sim_lab_proxy: data.sim_lab_proxy,
                    });
                }
            }
        } catch (e) {
            console.error(`${label} error:`, e.message);
        }
    }
}

main();
