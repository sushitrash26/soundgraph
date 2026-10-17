import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Music2, Sparkles, CheckCircle2, ExternalLink, Link2, Search, Sliders, X } from 'lucide-react';
import axios from 'axios';

const YouTubeIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

export default function AccountConnectBar() {
  const { 
    user, 
    triggerDemoSeed, 
    isLoading, 
    fetchRecommendations, 
    fetchGraphData, 
    fetchStats 
  } = useStore();

  const [spotifyModalOpen, setSpotifyModalOpen] = useState(false);
  const [ytModalOpen, setYtModalOpen] = useState(false);
  const [authStatus, setAuthStatus] = useState({ spotify_connected: false, youtube_connected: true });

  // Spotify state
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [spotifyLoading, setSpotifyLoading] = useState(false);

  // YouTube state
  const [ytMode, setYtMode] = useState('playlist'); // 'playlist' | 'search' | 'headers'
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [searchArtists, setSearchArtists] = useState('');
  const [ytHeaders, setYtHeaders] = useState('');
  const [ytLoading, setYtLoading] = useState(false);
  const [ytSuccessMsg, setYtSuccessMsg] = useState('');

  useEffect(() => {
    checkStatus();
    // Check if redirected from Spotify OAuth
    const params = new URLSearchParams(window.location.search);
    if (params.get('spotify_auth') === 'success') {
      triggerSpotifyIngestion();
    }
  }, []);

  const checkStatus = async () => {
    try {
      const res = await axios.get('http://localhost:8001/auth/status');
      setAuthStatus(res.data);
    } catch (e) {
      console.warn('Could not fetch auth status', e);
    }
  };

  const triggerSpotifyIngestion = async () => {
    try {
      await axios.post('http://localhost:8001/ingest/spotify');
      setTimeout(async () => {
        await fetchStats();
        await fetchRecommendations();
        await fetchGraphData();
      }, 3000);
    } catch (e) {
      console.error('Failed to trigger Spotify ingestion', e);
    }
  };

  const handleSpotifyOAuthDirect = async () => {
    setSpotifyLoading(true);
    try {
      const res = await axios.get('http://localhost:8001/auth/spotify/login');
      if (res.data.login_url) {
        window.location.href = res.data.login_url;
      } else {
        // Need to enter keys
        alert(res.data.message || 'Please enter your Spotify Client ID and Secret below.');
      }
    } catch (e) {
      alert('Error connecting to Spotify.');
    } finally {
      setSpotifyLoading(false);
    }
  };

  const handleSaveSpotifyCreds = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      alert('Please enter both Spotify Client ID and Secret.');
      return;
    }
    setSpotifyLoading(true);
    try {
      const res = await axios.post('http://localhost:8001/auth/spotify/credentials', {
        client_id: clientId.trim(),
        client_secret: clientSecret.trim()
      });
      if (res.data.login_url) {
        window.location.href = res.data.login_url;
      }
    } catch (e) {
      alert('Failed to save Spotify credentials: ' + (e.response?.data?.detail || e.message));
    } finally {
      setSpotifyLoading(false);
    }
  };

  const handleSyncYouTube = async () => {
    setYtLoading(true);
    setYtSuccessMsg('');
    try {
      let payload = { user_id: user?.id || 'astitva_demo_user' };
      if (ytMode === 'playlist') {
        payload.playlist_url = playlistUrl.trim();
      } else if (ytMode === 'search') {
        payload.artists_search = searchArtists.trim();
      } else {
        await axios.post('http://localhost:8001/auth/youtube/setup', { headers: ytHeaders });
      }

      await axios.post('http://localhost:8001/ingest/youtube/sync', payload);
      setYtSuccessMsg('Sync started! Pulling tracks and updating recommendations...');

      setTimeout(async () => {
        await fetchStats();
        await fetchRecommendations();
        await fetchGraphData();
        setYtLoading(false);
        setYtModalOpen(false);
      }, 4000);
    } catch (e) {
      alert('YouTube sync error: ' + (e.response?.data?.detail || e.message));
      setYtLoading(false);
    }
  };

  return (
    <>
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          
          {/* Account Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Connected Accounts:
            </span>

            {/* Spotify Badge/Button */}
            <button 
              onClick={() => setSpotifyModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '8px',
                background: authStatus.spotify_connected ? 'rgba(29, 185, 84, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${authStatus.spotify_connected ? 'rgba(29, 185, 84, 0.4)' : 'var(--border-color)'}`,
                color: authStatus.spotify_connected ? '#1db954' : '#fff',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Music2 size={15} color="#1db954" />
              {authStatus.spotify_connected ? 'Spotify Connected ✓' : '+ Connect Spotify'}
            </button>

            {/* YouTube Music Badge/Button */}
            <button 
              onClick={() => setYtModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '8px',
                background: 'rgba(255, 0, 51, 0.12)',
                border: '1px solid rgba(255, 0, 51, 0.35)',
                color: '#ff334b',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <YouTubeIcon size={15} />
              + Connect / Sync YouTube Music
            </button>
          </div>

          {/* Quick Demo Seed Shortcut */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              className="btn-primary" 
              onClick={triggerDemoSeed}
              disabled={isLoading}
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              <Sparkles size={15} />
              {isLoading ? 'Syncing Unified Graph...' : 'Re-Seed Demo Data'}
            </button>
          </div>

        </div>
      </div>

      {/* Spotify Modal */}
      {spotifyModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(10px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '28px', position: 'relative' }}>
            <button 
              onClick={() => setSpotifyModalOpen(false)}
              style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ background: 'rgba(29, 185, 84, 0.15)', padding: '8px', borderRadius: '10px', color: '#1db954' }}>
                <Music2 size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>Connect Spotify Account</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Ingest your top tracks, listening history & audio DNA</p>
              </div>
            </div>

            {/* Quick 1-Click OAuth button */}
            <div style={{ marginBottom: '20px', marginTop: '16px' }}>
              <button 
                className="btn-spotify" 
                onClick={handleSpotifyOAuthDirect}
                disabled={spotifyLoading}
                style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '14px' }}
              >
                <Music2 size={18} />
                Connect with Spotify OAuth
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0', color: 'var(--text-dim)', fontSize: '12px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
              <span>OR ENTER API CREDENTIALS</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Spotify Client ID
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. 7c94ba2d..." 
                  value={clientId} 
                  onChange={(e) => setClientId(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Spotify Client Secret
                </label>
                <input 
                  type="password" 
                  placeholder="e.g. 4f18bc..." 
                  value={clientSecret} 
                  onChange={(e) => setClientSecret(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                />
              </div>
            </div>

            <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '18px', lineHeight: '1.4' }}>
              Get keys free from <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)' }}>developer.spotify.com</a>. Set redirect URI to <code>http://localhost:8001/auth/spotify/callback</code>.
            </p>

            <button 
              className="btn-primary" 
              onClick={handleSaveSpotifyCreds}
              disabled={spotifyLoading}
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            >
              {spotifyLoading ? 'Saving & Redirecting...' : 'Save Keys & Launch Spotify Login'}
            </button>
          </div>
        </div>
      )}

      {/* YouTube Music Modal */}
      {ytModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(10px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '28px', position: 'relative' }}>
            <button 
              onClick={() => setYtModalOpen(false)}
              style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(255, 0, 51, 0.15)', padding: '8px', borderRadius: '10px', color: '#ff334b' }}>
                <YouTubeIcon size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>Connect YouTube Music</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sync your playlists, favorite artists, or liked songs</p>
              </div>
            </div>

            {/* Mode Selector Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px' }}>
              <button 
                onClick={() => setYtMode('playlist')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  border: 'none',
                  background: ytMode === 'playlist' ? 'rgba(255, 0, 51, 0.25)' : 'transparent',
                  color: ytMode === 'playlist' ? '#fff' : 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Playlist URL
              </button>
              <button 
                onClick={() => setYtMode('search')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  border: 'none',
                  background: ytMode === 'search' ? 'rgba(255, 0, 51, 0.25)' : 'transparent',
                  color: ytMode === 'search' ? '#fff' : 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Favorite Artists
              </button>
              <button 
                onClick={() => setYtMode('headers')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  border: 'none',
                  background: ytMode === 'headers' ? 'rgba(255, 0, 51, 0.25)' : 'transparent',
                  color: ytMode === 'headers' ? '#fff' : 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Browser Headers
              </button>
            </div>

            {ytMode === 'playlist' && (
              <div style={{ marginBottom: '18px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  YouTube Music Playlist Link or ID
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. https://music.youtube.com/playlist?list=RDCLAK5uy_k..." 
                  value={playlistUrl}
                  onChange={(e) => setPlaylistUrl(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginTop: '4px' }}>
                  Paste any public, unlisted, or shared YouTube Music playlist to pull all its tracks!
                </span>
              </div>
            )}

            {ytMode === 'search' && (
              <div style={{ marginBottom: '18px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Favorite Artists or Music Queries
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. Arijit Singh, Daft Punk, Tame Impala, Diljit Dosanjh" 
                  value={searchArtists}
                  onChange={(e) => setSearchArtists(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginTop: '4px' }}>
                  Searches YouTube Music and pulls top tracks into your taste knowledge graph.
                </span>
              </div>
            )}

            {ytMode === 'headers' && (
              <div style={{ marginBottom: '18px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  ytmusicapi Headers JSON
                </label>
                <textarea 
                  rows={4}
                  placeholder="Paste browser request headers JSON..."
                  value={ytHeaders}
                  onChange={(e) => setYtHeaders(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '12px',
                    fontFamily: 'monospace'
                  }}
                />
              </div>
            )}

            {ytSuccessMsg && (
              <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', color: '#34d399', fontSize: '12px', marginBottom: '14px' }}>
                {ytSuccessMsg}
              </div>
            )}

            <button 
              className="btn-youtube" 
              onClick={handleSyncYouTube}
              disabled={ytLoading}
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            >
              <YouTubeIcon size={16} />
              {ytLoading ? 'Ingesting YouTube Music & Running GDS...' : 'Sync to Taste Graph'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
