import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Sparkles, ArrowRight, ShieldCheck, Zap, Radio, Music2, ExternalLink, X } from 'lucide-react';
import axios from 'axios';

const YouTubeIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const GoogleIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
  </svg>
);

export default function Landing() {
  const { setActiveTab, loginAsGuest, isLoading } = useStore();
  const [googleModal, setGoogleModal] = useState(false);
  const [spotifyModal, setSpotifyModal] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      const res = await axios.get('http://localhost:8001/auth/google/login');
      if (res.data.login_url) {
        window.location.href = res.data.login_url;
      } else {
        setGoogleModal(true);
      }
    } catch (e) {
      setGoogleModal(true);
    }
  };

  const handleSpotifyLogin = async () => {
    try {
      const res = await axios.get('http://localhost:8001/auth/spotify/login');
      if (res.data.login_url) {
        window.location.href = res.data.login_url;
      } else {
        setSpotifyModal(true);
      }
    } catch (e) {
      setSpotifyModal(true);
    }
  };

  const handleSaveGoogleCreds = async () => {
    setSubmitting(true);
    try {
      const res = await axios.post('http://localhost:8001/auth/google/credentials', {
        client_id: clientId.trim(),
        client_secret: clientSecret.trim()
      });
      if (res.data.login_url) {
        window.location.href = res.data.login_url;
      }
    } catch (e) {
      alert('Failed: ' + (e.response?.data?.detail || e.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveSpotifyCreds = async () => {
    setSubmitting(true);
    try {
      const res = await axios.post('http://localhost:8001/auth/spotify/credentials', {
        client_id: clientId.trim(),
        client_secret: clientSecret.trim()
      });
      if (res.data.login_url) {
        window.location.href = res.data.login_url;
      }
    } catch (e) {
      alert('Failed: ' + (e.response?.data?.detail || e.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
      {/* Hero Section */}
      <div style={{ textAlign: 'center', padding: '40px 0 30px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <img 
            src="/soundgraph_logo.jpg" 
            alt="SoundGraph Logo" 
            style={{ 
              width: '96px', 
              height: '96px', 
              borderRadius: '24px', 
              border: '2px solid rgba(168, 85, 247, 0.4)', 
              boxShadow: '0 0 36px rgba(168, 85, 247, 0.45)',
              objectFit: 'cover' 
            }} 
          />
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          background: 'rgba(168, 85, 247, 0.1)',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          borderRadius: '999px',
          color: '#c084fc',
          fontSize: '13px',
          fontWeight: '600',
          marginBottom: '24px'
        }}>
          <Sparkles size={16} /> Cross-Platform Knowledge Graph Recommendation Engine
        </div>

        <h1 style={{
          fontSize: '54px',
          fontWeight: '800',
          lineHeight: '1.15',
          marginBottom: '20px',
          fontFamily: 'var(--font-heading)',
          background: 'linear-gradient(135deg, #ffffff 30%, #c084fc 70%, #06b6d4 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Your Music Taste, Mapped.
        </h1>

        <p style={{
          fontSize: '17px',
          color: 'var(--text-muted)',
          maxWidth: '680px',
          margin: '0 auto 36px',
          lineHeight: '1.6'
        }}>
          Sign in with your Google or Spotify account. We automatically ingest your listening telemetry, map it in a Neo4j Knowledge Graph, and surface topological recommendations.
        </p>

        {/* Big Login Card */}
        <div className="glass-panel" style={{ maxWidth: '480px', margin: '0 auto 40px', padding: '32px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>
            Get Started
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
            Choose an account to initialize your music taste profile:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Google / YouTube Login Button */}
            <button 
              className="btn-secondary" 
              onClick={handleGoogleLogin}
              style={{
                justifyContent: 'center',
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: '600',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
              }}
            >
              <GoogleIcon size={18} />
              Continue with Google (YouTube Music)
            </button>

            {/* Spotify Login Button */}
            <button 
              className="btn-spotify" 
              onClick={handleSpotifyLogin}
              style={{
                justifyContent: 'center',
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: '600',
              }}
            >
              <Music2 size={18} />
              Continue with Spotify
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '6px 0', color: 'var(--text-dim)', fontSize: '11px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
              <span>OR TRY INSTANTLY</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
            </div>

            {/* Guest / Demo Login */}
            <button 
              className="btn-primary" 
              onClick={loginAsGuest}
              disabled={isLoading}
              style={{
                justifyContent: 'center',
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: '600',
              }}
            >
              <Sparkles size={16} />
              {isLoading ? 'Loading Session...' : 'Instant Demo Profile (Astitva Pathak)'}
            </button>
          </div>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px',
      }}>
        <div className="glass-panel" style={{ padding: '28px' }}>
          <div style={{ background: 'rgba(168, 85, 247, 0.15)', width: 44, height: 44, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc', marginBottom: '16px' }}>
            <Zap size={22} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>
            Automated Telemetry Ingestion
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            Once you log in, we instantly pull your liked music, playlists, and recently played songs, structuring them into transactional Neo4j nodes.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '28px' }}>
          <div style={{ background: 'rgba(6, 182, 212, 0.15)', width: 44, height: 44, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22d3ee', marginBottom: '16px' }}>
            <Radio size={22} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>
            Cross-Account Taste Harmonization
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            Link both Spotify and YouTube Music accounts to merge fragmented listening histories and eliminate cross-platform recommendation silos.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '28px' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', width: 44, height: 44, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399', marginBottom: '16px' }}>
            <ShieldCheck size={22} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>
            Explainable Graph AI (XAI)
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            Recommendations are backed by mathematical Cypher paths and GDS similarity scores, providing clear human-readable explanations.
          </p>
        </div>
      </div>

      {/* Google Setup Modal */}
      {googleModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '28px', position: 'relative' }}>
            <button onClick={() => setGoogleModal(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>Google Cloud Credentials</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Create an OAuth Client ID on Google Cloud Console with redirect URI <code>http://localhost:8001/auth/google/callback</code>
            </p>
            <input 
              type="text" placeholder="Google Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)}
              style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 14px', color: '#fff', marginBottom: '12px' }}
            />
            <input 
              type="password" placeholder="Google Client Secret" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)}
              style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 14px', color: '#fff', marginBottom: '16px' }}
            />
            <button className="btn-primary" onClick={handleSaveGoogleCreds} disabled={submitting} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
              {submitting ? 'Saving & Redirecting...' : 'Save & Launch Google Login'}
            </button>
          </div>
        </div>
      )}

      {/* Spotify Setup Modal */}
      {spotifyModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '28px', position: 'relative' }}>
            <button onClick={() => setSpotifyModal(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>Spotify Developer Credentials</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Create an App at <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)' }}>developer.spotify.com</a> with redirect URI <code>http://localhost:8001/auth/spotify/callback</code>
            </p>
            <input 
              type="text" placeholder="Spotify Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)}
              style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 14px', color: '#fff', marginBottom: '12px' }}
            />
            <input 
              type="password" placeholder="Spotify Client Secret" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)}
              style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 14px', color: '#fff', marginBottom: '16px' }}
            />
            <button className="btn-spotify" onClick={handleSaveSpotifyCreds} disabled={submitting} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
              {submitting ? 'Saving & Redirecting...' : 'Save & Launch Spotify Login'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
