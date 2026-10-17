import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { LogIn, Sparkles, CheckCircle2, Music2, Video } from 'lucide-react';
import axios from 'axios';

const YouTubeIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

export default function AuthPanel() {
  const { triggerDemoSeed, isLoading } = useStore();
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [ytModalOpen, setYtModalOpen] = useState(false);
  const [ytHeaders, setYtHeaders] = useState('');
  const [ytSuccess, setYtSuccess] = useState(false);

  const handleSpotifyConnect = async () => {
    setSpotifyLoading(true);
    try {
      const res = await axios.get('http://localhost:8001/auth/spotify/login');
      if (res.data.login_url) {
        window.location.href = res.data.login_url;
      } else {
        alert(res.data.message || 'Spotify credentials not configured in .env yet. Try the Instant Seed Demo below!');
      }
    } catch (e) {
      alert('Error connecting to Spotify backend.');
    } finally {
      setSpotifyLoading(false);
    }
  };

  const handleYtSave = async () => {
    try {
      await axios.post('http://localhost:8001/auth/youtube/setup', {
        headers: ytHeaders || {}
      });
      setYtSuccess(true);
      setTimeout(() => setYtModalOpen(false), 1200);
    } catch (e) {
      alert('Failed to configure YouTube Music.');
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>
            Connect Music Platforms
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Merge your Spotify library and YouTube Music listening history into a unified Neo4j Knowledge Graph.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button 
            className="btn-spotify" 
            onClick={handleSpotifyConnect}
            disabled={spotifyLoading}
          >
            <Music2 size={16} />
            Connect Spotify
          </button>

          <button 
            className="btn-youtube" 
            onClick={() => setYtModalOpen(true)}
          >
            <YouTubeIcon size={16} />
            Connect YouTube Music
          </button>

          <button 
            className="btn-primary" 
            onClick={triggerDemoSeed}
            disabled={isLoading}
          >
            <Sparkles size={16} />
            {isLoading ? 'Seeding Unified Graph...' : 'Instant Cross-Platform Seed'}
          </button>
        </div>
      </div>

      {/* YouTube Headers Modal */}
      {ytModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>
              Connect YouTube Music
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              ytmusicapi uses authenticated session request headers from your browser. Paste your headers JSON or leave empty for public mode:
            </p>

            <textarea
              rows={5}
              placeholder="Paste request headers or cookie string (optional)..."
              value={ytHeaders}
              onChange={(e) => setYtHeaders(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: '#fff',
                padding: '10px',
                fontSize: '12px',
                marginBottom: '16px',
                fontFamily: 'monospace'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn-secondary" onClick={() => setYtModalOpen(false)}>
                Cancel
              </button>
              <button className="btn-youtube" onClick={handleYtSave}>
                {ytSuccess ? <CheckCircle2 size={16} /> : null}
                {ytSuccess ? 'Saved!' : 'Save & Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
