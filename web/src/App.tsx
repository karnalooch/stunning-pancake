import { useState, useEffect } from 'react'
import './index.css'

function App() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className={`app-wrapper ${mounted ? 'fade-in' : ''}`}>
      <div className="aura-container">
        <div className="aura-blob" style={{ top: '10%', left: '10%' }}></div>
        <div className="aura-blob" style={{ bottom: '10%', right: '10%' }}></div>
      </div>

      <div className="container">
        <nav>
          <div className="logo-text">SPORT PLATFORM</div>
          <div className="nav-links">
            <button className="cta-button" style={{ padding: '0.6rem 1.5rem', fontSize: '0.9rem' }}>
              Launch Console
            </button>
          </div>
        </nav>

        <header className="hero">
          <h1 className="glow-text">The Future of <br />Athletic Integrity</h1>
          <p>
            A high-fidelity sports ecosystem powered by real-time GPS telemetry, 
            multi-layer anti-cheat verification, and professional race moderation.
          </p>
          <div className="hero-ctas">
            <button className="cta-button">Explore the Platform</button>
          </div>
        </header>

        <section className="features-grid">
          <div className="feature-card glass">
            <div className="icon">📡</div>
            <h3>Live Telemetry</h3>
            <p>10,000+ concurrent requests/sec handled by our FastAPI & Redis ingestion pipeline.</p>
          </div>
          
          <div className="feature-card glass">
            <div className="icon">🛡️</div>
            <h3>Anti-Cheat v2</h3>
            <p>From Kinematic Gates to BRouter Viterbi Matching. We don't just track; we verify.</p>
          </div>

          <div className="feature-card glass">
            <div className="icon">⚖️</div>
            <h3>Moderator Hub</h3>
            <p>Direct oversight for municipal competitions with advanced track inspection tools.</p>
          </div>

          <div className="feature-card glass">
            <div className="icon">💳</div>
            <h3>Monetization</h3>
            <p>Seamless Stripe integration for B2B organizers and B2C sports enthusiasts.</p>
          </div>
        </section>

        <footer style={{ padding: '4rem 0', textAlign: 'center', opacity: 0.5 }}>
          <p>© 2026 SPORT Platform. Built with Python & TypeScript.</p>
        </footer>
      </div>
    </div>
  )
}

export default App
