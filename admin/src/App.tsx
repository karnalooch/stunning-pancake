import 'maplibre-gl/dist/maplibre-gl.css';
import './index.css';
import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import type { ViewId } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { LiveTrackingView } from './views/LiveTrackingView';
import { EventsView } from './views/EventsView';
import { ClubsView } from './views/ClubsView';
import { AntiCheatView } from './views/AntiCheatView';
import { AnalyticsView } from './views/AnalyticsView';
import { ModeratorView } from './views/ModeratorView';

// ─── Session context (replace with real auth context in Phase 2+ full wiring) ───
const SESSION = {
  userName: 'Wojciech Kowalski',
  userRole: 'GLOBAL_ADMIN',
};

/**
 * App — thin orchestrator (Phase 5 refactor).
 *
 * Responsibility: layout skeleton + view routing.
 * All logic lives inside individual view modules under src/views/.
 *
 * Adding a new module:
 *   1. Create src/views/MyView.tsx
 *   2. Add entry to NAV_ITEMS in Sidebar.tsx
 *   3. Add case in renderView() below — done.
 */
const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewId>('live');

  const renderView = () => {
    switch (activeView) {
      case 'live':      return <LiveTrackingView />;
      case 'events':    return <EventsView />;
      case 'clubs':     return <ClubsView />;
      case 'anticheat': return <AntiCheatView />;
      case 'moderator': return <ModeratorView />;
      case 'analytics': return <AnalyticsView />;
      default:          return <LiveTrackingView />;
    }
  };

  const viewTitles: Record<ViewId, string> = {
    live:      'Real-Time Live Tracking',
    events:    'Event Management',
    clubs:     'Clubs & Challenges',
    anticheat: 'Anti-Cheat Monitor',
    moderator: 'Moderator Control Panel',
    analytics: 'City Analytics',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-deep)' }}>
      {/* Top bar */}
      <TopBar
        userName={SESSION.userName}
        userRole={SESSION.userRole}
      />

      {/* Body: sidebar + content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar
          activeView={activeView}
          onViewChange={setActiveView}
          userRole={SESSION.userRole}
        />

        {/* Main content area */}
        <main style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0',
        }}>
          {/* View title */}
          <div style={{ marginBottom: '20px' }}>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px' }}>
              {viewTitles[activeView]}
            </h1>
          </div>

          {/* Active view */}
          <div style={{ flex: 1 }}>
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
