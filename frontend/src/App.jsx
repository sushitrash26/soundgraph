import React, { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Explorer from './pages/Explorer';
import AudioPlayerBar from './components/AudioPlayerBar';
import AcousticLensModal from './components/AcousticLensModal';
import OmniSearchBar from './components/OmniSearchBar';
import CreateDeckModal from './components/CreateDeckModal';
import AddToDeckModal from './components/AddToDeckModal';
import AIAnswerModal from './components/AIAnswerModal';
import { Music, Network, LayoutDashboard, Sparkles, Radio, Disc3, LogOut, CheckCircle2, Music2 } from 'lucide-react';
import axios from 'axios';

const YouTubeIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

export default function App() {
  const { 
    user, 
    activeTab, 
    setActiveTab, 
    checkAuth, 
    logout, 
    authStatus, 
    triggerDemoSeed, 
    isLoading,
    isCheckingAuth,
    refreshDashboard,
    toggleChat,
    addLiveEvent,
    appendFrontierCandidates,
    currentTrack,
    isAcousticLensOpen,
    setIsAcousticLensOpen,
    toggleAcousticLens
  } = useStore();

  const [notification, setNotification] = useState('');

  useEffect(() => {
    checkAuth();

    // Check query params for OAuth redirects or path-based route
    const params = new URLSearchParams(window.location.search);
    if (params.get('spotify_auth') === 'success') {
      setActiveTab('dashboard');
      setNotification('Spotify connected! Auto-ingesting listening history...');
      axios.post('http://localhost:8001/ingest/spotify').then(() => {
        setTimeout(() => refreshDashboard(), 3500);
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('google_auth') === 'success') {
      setActiveTab('dashboard');
      setNotification('Google connected! Auto-ingesting YouTube Music & liked songs...');
      axios.post('http://localhost:8001/ingest/youtube').then(() => {
        setTimeout(() => refreshDashboard(), 3500);
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('google_auth') === 'error') {
      setNotification(`Google login failed: ${params.get('msg') || 'Check credentials'}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('spotify_auth') === 'error') {
      setNotification(`Spotify login failed: ${params.get('msg') || 'Check credentials'}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (window.location.pathname.includes('/dashboard')) {
      setActiveTab('dashboard');
    } else if (window.location.pathname.includes('/explorer')) {
      setActiveTab('explorer');
    }

    // Connect to global WebSocket stream for live graph updates & frontier expansion
    let ws;
    try {
      ws = new WebSocket('ws://localhost:8001/ws/live');
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'frontier_candidates_ready' && data.candidates) {
            appendFrontierCandidates(data.candidates);
            setNotification(data.message || '✨ New frontier tracks synthesized into your deck!');
          }
          if (data.type === 'ingestion_complete' || data.type === 'gds_complete') {
            refreshDashboard();
            setNotification(data.message || 'Taste graph updated with your latest music!');
          }
          if (data.type === 'ingestion_progress' || data.type === 'gds_progress') {
            setNotification(data.status || 'Updating music graph...');
          }
          addLiveEvent({
            time: new Date().toLocaleTimeString(),
            title: data.status || data.type || 'Event',
            detail: data.message || data.stage || JSON.stringify(data),
            type: data.type || 'info',
          });
        } catch (e) {
          // ignore parsing error
        }
      };
    } catch (e) {
      console.warn('Global WS error:', e);
    }

    return () => {
      if (ws) ws.close();
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Banner Alert if OAuth just finished */}
      {notification && (
        <div style={{
          background: 'linear-gradient(90deg, #a855f7 0%, #06b6d4 100%)',
          color: '#fff',
          padding: '8px 20px',
          textAlign: 'center',
          fontSize: '13px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          <Sparkles size={16} />
          {notification}
        </div>
      )}

        {/* Top Navigation Bar for Dashboard / Explorer */}
        {user && activeTab !== 'landing' && (
        <header style={{
          background: 'rgba(10, 11, 16, 0.85)',
          backdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          padding: '0 28px',
          height: '70px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Brand */}
          <div 
            onClick={() => setActiveTab(user ? 'dashboard' : 'landing')} 
            style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
          >
            <img 
              src="/soundgraph_logo.jpg" 
              alt="SoundGraph Logo" 
              style={{
                width: 38,
                height: 38,
                borderRadius: '12px',
                objectFit: 'cover',
                border: '1.5px solid rgba(168, 85, 247, 0.4)',
                boxShadow: '0 0 20px rgba(168, 85, 247, 0.35)'
              }}
            />
            <div>
              <span style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'var(--font-heading)', color: '#fff', letterSpacing: '-0.02em' }}>
                Sound<span style={{ background: 'linear-gradient(135deg, #c084fc, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Graph</span>
              </span>
            </div>
          </div>

          {/* Center: Google-Style Omni Search Bar with Integrated Ask AI */}
          <div style={{ flex: 1, maxWidth: '560px', margin: '0 20px' }}>
            <OmniSearchBar />
          </div>

          {/* Right Controls: Connections + Acoustic Lens + User Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {/* Spotify Connection State */}
            {authStatus?.spotify_connected ? (
              <div 
                title="Spotify Connected"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  background: 'rgba(29, 185, 84, 0.12)',
                  border: '1px solid rgba(29, 185, 84, 0.35)',
                  color: '#4ade80',
                  fontSize: '11px',
                  fontWeight: '600'
                }}
              >
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#22c55e',
                  boxShadow: '0 0 8px #22c55e'
                }} />
                <Music2 size={12} />
                <span className="hidden md:inline">Spotify</span>
              </div>
            ) : (
              <button
                onClick={() => window.location.href = 'http://localhost:8001/auth/spotify/login'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#e2e8f0',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
                title="Connect Spotify Account"
              >
                <Music2 size={12} />
                <span className="hidden md:inline">+ Spotify</span>
              </button>
            )}

            {/* YouTube Connection State */}
            {authStatus?.google_connected ? (
              <div 
                title="YouTube Music Connected"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#f87171',
                  fontSize: '11px',
                  fontWeight: '600'
                }}
              >
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  boxShadow: '0 0 8px #ef4444'
                }} />
                <YouTubeIcon size={12} />
                <span className="hidden md:inline">YouTube</span>
              </div>
            ) : (
              <button
                onClick={() => window.location.href = 'http://localhost:8001/auth/google/login'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#e2e8f0',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
                title="Connect YouTube Music Account"
              >
                <YouTubeIcon size={12} />
                <span className="hidden md:inline">+ YouTube</span>
              </button>
            )}
          </div>

          {/* Right Controls: Chat Trigger + Acoustic Lens + Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Acoustic Lens (Super-Shazam & YouTube Resolver) Trigger */}
            <button
              onClick={toggleAcousticLens}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 16px',
                borderRadius: '999px',
                background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.22) 0%, rgba(168, 85, 247, 0.22) 100%)',
                border: '1px solid rgba(236, 72, 153, 0.45)',
                color: '#fff',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 16px rgba(236, 72, 153, 0.18)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.03)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              title="Acoustic Lens: Hum, play chords, or identify any ambient song with YouTube stream"
            >
              <Radio size={14} color="#f472b6" className="pulse" />
              <span>Acoustic Lens</span>
            </button>

            {/* Minimal Claude/Gemini Style Assistant Trigger */}
            <button
              onClick={toggleChat}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 16px',
                borderRadius: '999px',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%)',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                color: '#fff',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 16px rgba(168, 85, 247, 0.15)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.03)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              title="Open Graph Mood Assistant"
            >
              <Sparkles size={14} color="#c084fc" />
              <span>Ask SoundGraph</span>
            </button>

            {user ? (
              <>
                {/* User Avatar Chip */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px 12px 4px 4px',
                  borderRadius: '999px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                  {user.avatar_url ? (
                    <img 
                      src={user.avatar_url} 
                      alt={user.name} 
                      style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} 
                    />
                  ) : (
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #a855f7, #06b6d4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#fff'
                    }}>
                      {user.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
                    </div>
                  )}
                  <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#fff' }}>
                    {user.name || 'Astitva'}
                  </span>
                </div>

                {/* Logout Button */}
                <button 
                  onClick={logout} 
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#ef4444';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#94a3b8';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  }}
                  title="Log out"
                >
                  <LogOut size={14} />
                </button>
              </>
            ) : (
              <button 
                className="btn-primary" 
                onClick={() => setActiveTab('landing')}
                style={{ padding: '7px 18px', fontSize: '12.5px' }}
              >
                Sign In
              </button>
            )}
          </div>
        </header>
        )}

      {/* Main View Router */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingBottom: currentTrack ? '90px' : '0' }}>
        {isCheckingAuth ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <div style={{ textAlign: 'center' }}>
              <img 
                src="/soundgraph_logo.jpg" 
                alt="SoundGraph" 
                style={{ 
                  width: 52, 
                  height: 52, 
                  borderRadius: '16px', 
                  boxShadow: '0 0 30px rgba(168, 85, 247, 0.4)',
                  border: '1.5px solid rgba(168, 85, 247, 0.5)',
                  marginBottom: '16px' 
                }} 
              />
              <div style={{ color: '#fff', fontSize: '15px', fontWeight: '700', fontFamily: 'var(--font-heading)' }}>
                Connecting to SoundGraph...
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12.5px', marginTop: '4px' }}>
                Verifying cross-platform taste graph session
              </div>
            </div>
          </div>
        ) : !user || activeTab === 'landing' ? (
          <Landing />
        ) : activeTab === 'explorer' ? (
          <Explorer />
        ) : (
          <Dashboard />
        )}
      </main>

      {/* Footer */}
      {user && activeTab !== 'landing' && (
      <footer style={{
        padding: '24px',
        paddingBottom: currentTrack ? '110px' : '24px',
        borderTop: '1px solid var(--border-color)',
        textAlign: 'center',
        fontSize: '12px',
        color: 'var(--text-dim)',
      }}>
        SoundGraph · Cross-Platform Graph Data Science Recommendation Engine · Powered by Neo4j & FastAPI
      </footer>
      )}

      {/* Embedded In-App Waveform Audio Player Bar */}
      <AudioPlayerBar />

      {/* Acoustic Lens Super-Shazam Modal */}
      <AcousticLensModal 
        isOpen={isAcousticLensOpen} 
        onClose={() => setIsAcousticLensOpen(false)} 
      />

      {/* User Decks & AI Modals */}
      <CreateDeckModal />
      <AddToDeckModal />
      <AIAnswerModal />
    </div>
  );
}
