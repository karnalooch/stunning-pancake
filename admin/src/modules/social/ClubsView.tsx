import { useEffect, useState } from 'react';

interface Club {
  id: number;
  name: string;
  sport_type: string;
  member_count: number;
  owner_username: string;
  tenant_id: string | null;
  created_at: string;
}

const SPORT_META: Record<string, { icon: string; color: string }> = {
  MIXED: { icon: '🏅', color: '#c77dff' },
  RUN:   { icon: '🏃', color: '#00d2ff' },
  BIKE:  { icon: '🚴', color: '#92fe9d' },
  WALK:  { icon: '🚶', color: '#ff9500' },
};

/**
 * Clubs management view — lists all clubs from the API with members count,
 * sport type, and owner. Includes create button for admins.
 */
export const ClubsView = () => {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch('http://localhost:8000/api/clubs/', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) setClubs(await res.json());
      } catch { /* offline */ }
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>Clubs & Challenges</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-dim)' }}>
            {clubs.length} klubów zarejestrowanych w platformie
          </p>
        </div>
        <button
          id="create-club-button"
          style={{
            padding: '10px 20px', borderRadius: '10px', border: 'none',
            background: 'linear-gradient(135deg, #c77dff, #8a2be2)',
            color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
          }}
        >
          + Nowy Klub
        </button>
      </div>

      {/* Clubs grid */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '60px' }}>Ładowanie...</div>
      ) : clubs.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛡️</div>
          <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Brak klubów</div>
          <div style={{ color: 'var(--text-dim)', fontSize: '14px' }}>Kluby pojawią się tutaj gdy atleciją założą lub gdy tenant je doda.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
          {clubs.map(club => {
            const meta = SPORT_META[club.sport_type] ?? SPORT_META.MIXED;
            return (
              <div key={club.id} className="glass-panel" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '14px',
                    background: `${meta.color}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '24px', flexShrink: 0,
                  }}>{meta.icon}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>{club.name}</div>
                    <div style={{ fontSize: '12px', color: meta.color, fontWeight: 600 }}>
                      {club.sport_type}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ background: 'var(--bg-deep)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: meta.color }}>{club.member_count}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600 }}>CZŁONKÓW</div>
                  </div>
                  <div style={{ background: 'var(--bg-deep)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>{club.owner_username}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600 }}>WŁAŚCICIEL</div>
                  </div>
                </div>

                {club.tenant_id && (
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>🏙️ {club.tenant_id}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
