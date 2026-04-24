import 'maplibre-gl/dist/maplibre-gl.css';
import './index.css';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { LiveTrackingView } from './views/LiveTrackingView';
import { EventsView } from './views/EventsView';
import { ClubsView } from './views/ClubsView';
import { AntiCheatView } from './views/AntiCheatView';
import { AnalyticsView } from './views/AnalyticsView';
import { ModeratorView } from './views/ModeratorView';
import { UserSimulator } from './components/UserSimulator';

const APP_MODE = (import.meta.env.VITE_APP_MODE || 'GLOBAL_ADMIN') as 'GLOBAL_ADMIN' | 'LOCAL_ADMIN' | 'MODERATOR';

const SESSION = {
  userName: 'Wojciech Kowalski',
  userRole: APP_MODE, // Role is locked by the application mode
};

const AppContent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const path = location.pathname.split('/').filter(Boolean)[0] || 'live';
  const activeView = path as any;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-deep)' }}>
      <TopBar
        userName={SESSION.userName}
        userRole={SESSION.userRole}
        appTitle={`${APP_MODE.replace('_', ' ')} PANEL`}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar
          activeView={activeView}
          onViewChange={(view) => navigate(`/${view}`)}
          userRole={SESSION.userRole}
        />

        <main style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0',
        }}>
          <Routes>
            {/* Common Routes */}
            <Route path="/live" element={<LiveTrackingView />} />
            
            {/* Mode Specific Routes */}
            {APP_MODE === 'GLOBAL_ADMIN' && (
               <>
                 <Route path="/analytics" element={<AnalyticsView />} />
                 <Route path="/anticheat" element={<AntiCheatView />} />
               </>
            )}

            {APP_MODE === 'LOCAL_ADMIN' && (
               <>
                 <Route path="/analytics" element={<AnalyticsView />} />
                 <Route path="/events" element={<EventsView />} />
                 <Route path="/clubs" element={<ClubsView />} />
               </>
            )}

            {APP_MODE === 'MODERATOR' && (
               <>
                 <Route path="/moderator" element={<ModeratorView />} />
                 <Route path="/anticheat" element={<AntiCheatView />} />
               </>
            )}

            <Route path="/" element={<LiveTrackingView />} />
          </Routes>
          
          <UserSimulator />
        </main>
      </div>
    </div>
  );
};

const App = () => (
  <Router>
    <AppContent />
  </Router>
);

export default App;
