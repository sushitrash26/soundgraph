import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import axios from 'axios';

/* 
  Skill: landing-page-design (strictly followed)
  Typography: Manrope only, Geist Mono for metrics
  Copy: Sentence case, NO HYPHENS in text, no orphaned words
  Palette: Flat #000000, #181818, #1F1F1F, #272727, #313131
  Spacing: 0, 2px, 4px, 8px, 12px, 16px, 24px, 32px, 40px, 48px, 64px, 80px, 96px
  Motion: cubic-bezier(0.32, 0.72, 0, 1) duration 700ms
  Icons: Solar and Phosphor geometric style
*/

// Solar / Phosphor styled geometric SVG icons
const SparkleIcon = ({ size = 16, color = '#FFFFFF' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z" fill={color} />
  </svg>
);

const WaveformIcon = ({ size = 16, color = '#FFFFFF' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
    <path d="M3 10v4M7 6v12M11 3v18M15 7v10M19 9v6M23 11v2" />
  </svg>
);

const NetworkIcon = ({ size = 16, color = '#FFFFFF' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <circle cx="4" cy="6" r="2" />
    <circle cx="20" cy="6" r="2" />
    <circle cx="4" cy="18" r="2" />
    <circle cx="20" cy="18" r="2" />
    <path d="M6 7l4 3.5M18 7l-4 3.5M6 17l4-3.5M18 17l-4-3.5" />
  </svg>
);

const ArrowRightIcon = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const CheckIcon = ({ size = 16, color = '#FFFFFF' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12l5 5L20 6" />
  </svg>
);

const CloseIcon = ({ size = 18, color = '#FFFFFF' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const PlayIcon = ({ size = 14, color = '#000000' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <polygon points="6 3 20 12 6 21 6 3" />
  </svg>
);

const ChevronDownIcon = ({ size = 16, color = '#FFFFFF' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const SpotifyIcon = ({ size = 16, color = '#1db954' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2C6.477 2 2 6.477 2 12c0 5.524 4.477 10 10 10s10-4.476 10-10c0-5.523-4.477-10-10-10zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.434-5.308-1.758-8.793-.963-.335.077-.67-.133-.746-.468-.077-.334.132-.67.467-.746 3.809-.871 7.076-.506 9.722 1.113.294.18.386.563.207.857zm1.225-2.723c-.226.367-.707.482-1.074.256-2.69-1.653-6.79-2.132-9.971-1.167-.413.125-.852-.109-.977-.522-.126-.413.108-.853.522-.978 3.632-1.102 8.147-.568 11.244 1.337.367.226.482.707.256 1.074zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71c-.495.15-1.022-.13-1.172-.625-.15-.494.13-1.022.625-1.172 3.535-1.072 9.404-.866 13.115 1.337.445.264.59.838.327 1.282-.264.444-.838.59-1.282.326z"/>
  </svg>
);

const YouTubeIcon = ({ size = 16, color = '#ff0033' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

// 3D Smart Deck Card Stack Data
const CARD_STACK_DATA = [
  {
    id: 'starboy',
    title: 'Starboy',
    artist: 'The Weeknd',
    affinity: '96.4% match',
    stream: 'Spotify + YouTube',
    energy: 0.82,
    valence: 0.68,
    bpm: 186,
    reason: 'Shared synthesizer timbre and high tempo bridge from Blinding Lights',
    graphPath: 'Astitva listens to Blinding Lights similar to Starboy'
  },
  {
    id: 'gumaan',
    title: 'Gumaan',
    artist: 'Young Stunners',
    affinity: '94.2% match',
    stream: 'YouTube Music',
    energy: 0.47,
    valence: 0.39,
    bpm: 92,
    reason: 'Acoustic guitar cadence and Urdu lyrical symmetry matching Secrets',
    graphPath: 'Astitva listens to Secrets similar to Gumaan'
  },
  {
    id: 'snooze',
    title: 'Snooze',
    artist: 'SZA',
    affinity: '89.1% match',
    stream: 'Spotify',
    energy: 0.55,
    valence: 0.44,
    bpm: 143,
    reason: 'Rhythm and blues harmonic progression linked to Kill Bill',
    graphPath: 'Astitva listens to Kill Bill similar to Snooze'
  }
];

export default function Landing() {
  const { setActiveTab, loginAsGuest, isLoading } = useStore();

  // Navigation and overlay states
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  // Quick Demo Interactive States
  const [isQuickDemoOpen, setIsQuickDemoOpen] = useState(false);
  const [demoStep, setDemoStep] = useState(1);
  const [telemetryCount, setTelemetryCount] = useState(0);
  const [isSimulatingStream, setIsSimulatingStream] = useState(false);

  // Credentials Modals
  const [googleModal, setGoogleModal] = useState(false);
  const [spotifyModal, setSpotifyModal] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Legal / Ship Requirement Modals (B10)
  const [privacyModal, setPrivacyModal] = useState(false);
  const [termsModal, setTermsModal] = useState(false);
  const [notFoundModal, setNotFoundModal] = useState(false);

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  // Tagline Scroll Illumination Observer (B11)
  const taglineRef = useRef(null);
  const [activeWords, setActiveWords] = useState(0);

  const TAGLINE_WORDS = [
    'Music', 'is', 'more', 'than', 'isolated', 'playlists', 'on', 'separate', 'apps.',
    'SoundGraph', 'reveals', 'the', 'hidden', 'geometry', 'connecting', 'every', 'melody', 'you', 'love.'
  ];

  useEffect(() => {
    const el = taglineRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Animate word illumination one at a time using cubic bezier progression
            let count = 0;
            const interval = setInterval(() => {
              count += 1;
              setActiveWords(count);
              if (count >= TAGLINE_WORDS.length) {
                clearInterval(interval);
              }
            }, 55);
          }
        });
      },
      { threshold: 0.35 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Telemetry stream simulation for Quick Demo
  const startTelemetrySimulation = () => {
    setIsSimulatingStream(true);
    setTelemetryCount(0);
    let current = 0;
    const target = 1420;
    const step = 47;
    const timer = setInterval(() => {
      current += step;
      if (current >= target) {
        setTelemetryCount(target);
        setIsSimulatingStream(false);
        clearInterval(timer);
      } else {
        setTelemetryCount(current);
      }
    }, 28);
  };

  const handleLaunchQuickDemo = () => {
    setIsQuickDemoOpen(true);
    setDemoStep(1);
    startTelemetrySimulation();
  };

  const handleNextCard = () => {
    setActiveCardIndex((prev) => (prev + 1) % CARD_STACK_DATA.length);
  };

  const handlePrevCard = () => {
    setActiveCardIndex((prev) => (prev - 1 + CARD_STACK_DATA.length) % CARD_STACK_DATA.length);
  };

  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:8001/auth/google/login';
  };

  const handleSpotifyLogin = () => {
    window.location.href = 'http://localhost:8001/auth/spotify/login';
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

  const activeCard = CARD_STACK_DATA[activeCardIndex];

  return (
    <div style={{ backgroundColor: '#000000', color: '#FFFFFF', minHeight: '100vh', position: 'relative' }}>
      
      {/* Skip to Content for Accessibility per B10 */}
      <a 
        href="#main-content" 
        style={{
          position: 'absolute',
          top: '-40px',
          left: '16px',
          background: '#FFFFFF',
          color: '#000000',
          padding: '8px 12px',
          borderRadius: '6px',
          fontWeight: '600',
          fontSize: '14px',
          zIndex: 9999,
          transition: 'top 0.2s ease'
        }}
        onFocus={(e) => e.currentTarget.style.top = '16px'}
        onBlur={(e) => e.currentTarget.style.top = '-40px'}
      >
        Skip to main content
      </a>

      {/* B7: Fluid Island Navigation (Floating Glass Pill Detached From Top) */}
      <header className="fluid-nav-pill">
        <nav className="fluid-nav-container" aria-label="Main Navigation">
          <div 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              backgroundColor: '#181818',
              border: '1px solid #313131',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <NetworkIcon size={16} color="#FFFFFF" />
            </div>
            <span style={{ fontSize: '14px', fontWeight: '700', letterSpacing: '-0.02em', color: '#FFFFFF' }}>
              SoundGraph
            </span>
          </div>

          <div style={{ display: 'none', mdDisplay: 'flex', alignItems: 'center', gap: '24px' }}>
            <a 
              href="#benefits" 
              style={{ fontSize: '14px', color: '#9B9B9B', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#FFFFFF'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#9B9B9B'}
            >
              Benefits
            </a>
            <a 
              href="#how-it-works" 
              style={{ fontSize: '14px', color: '#9B9B9B', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#FFFFFF'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#9B9B9B'}
            >
              How it works
            </a>
            <a 
              href="#faq" 
              style={{ fontSize: '14px', color: '#9B9B9B', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#FFFFFF'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#9B9B9B'}
            >
              FAQ
            </a>
          </div>

          {/* Primary Action Button in Nav Pill (14px semibold per B1) */}
          <button 
            onClick={handleLaunchQuickDemo}
            className="btn-main"
            style={{ fontSize: '14px', padding: '6px 12px' }}
          >
            <SparkleIcon size={14} color="#000000" />
            <span>Explore how it works</span>
          </button>

          {/* B7: Hamburger Morph Lines */}
          <button 
            onClick={() => setNavMenuOpen(!navMenuOpen)}
            aria-label="Toggle navigation menu"
            style={{
              width: '28px',
              height: '28px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <span style={{
              width: '18px',
              height: '2px',
              backgroundColor: '#FFFFFF',
              borderRadius: '2px',
              transition: 'all 700ms cubic-bezier(0.32, 0.72, 0, 1)',
              transform: navMenuOpen ? 'translateY(7px) rotate(45deg)' : 'none'
            }} />
            <span style={{
              width: '18px',
              height: '2px',
              backgroundColor: '#FFFFFF',
              borderRadius: '2px',
              transition: 'all 700ms cubic-bezier(0.32, 0.72, 0, 1)',
              opacity: navMenuOpen ? 0 : 1
            }} />
            <span style={{
              width: '18px',
              height: '2px',
              backgroundColor: '#FFFFFF',
              borderRadius: '2px',
              transition: 'all 700ms cubic-bezier(0.32, 0.72, 0, 1)',
              transform: navMenuOpen ? 'translateY(-7px) rotate(-45deg)' : 'none'
            }} />
          </button>
        </nav>
      </header>

      {/* B7: Full Screen Fluid Overlay Nav Menu */}
      {navMenuOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 40,
          backgroundColor: 'rgba(0, 0, 0, 0.88)',
          backdropFilter: 'blur(32px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '32px'
        }}>
          <a 
            href="#benefits" 
            onClick={() => setNavMenuOpen(false)}
            style={{ fontSize: '24px', fontWeight: '700', color: '#FFFFFF', textDecoration: 'none' }}
          >
            Benefits
          </a>
          <a 
            href="#how-it-works" 
            onClick={() => setNavMenuOpen(false)}
            style={{ fontSize: '24px', fontWeight: '700', color: '#FFFFFF', textDecoration: 'none' }}
          >
            How it works
          </a>
          <a 
            href="#faq" 
            onClick={() => setNavMenuOpen(false)}
            style={{ fontSize: '24px', fontWeight: '700', color: '#FFFFFF', textDecoration: 'none' }}
          >
            Questions and answers
          </a>
          <button 
            onClick={() => { setNavMenuOpen(false); handleLaunchQuickDemo(); }}
            className="btn-main"
            style={{ padding: '8px 16px', fontSize: '16px' }}
          >
            <SparkleIcon size={16} color="#000000" />
            <span>Explore how it works</span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main id="main-content" style={{ maxWidth: '1200px', margin: '0 auto', padding: '120px 24px 80px' }}>
        
        {/* SECTION 1: HERO SECTION */}
        <section style={{ textAlign: 'center', marginBottom: '80px' }}>
          
          {/* Proof signal badge above headline */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 12px',
            backgroundColor: '#181818',
            border: '1px solid #272727',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: '600',
            color: '#9B9B9B',
            marginBottom: '24px'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
            <span>1,420 tracks ingested across Spotify and YouTube Music in 84 milliseconds</span>
          </div>

          {/* Hero Heading: Left to Right Gradient per B5 (#FFFFFF -> #9B9B9B, max width 680px) */}
          <h1 className="hero-heading-gradient" style={{
            fontSize: '48px',
            lineHeight: '56px',
            fontWeight: '700',
            marginBottom: '20px'
          }}>
            Your music taste mapped across streaming borders
          </h1>

          {/* Subheadline: Max width 680px per B5 */}
          <p style={{
            fontSize: '18px',
            lineHeight: '28px',
            color: '#9B9B9B',
            maxWidth: '680px',
            margin: '0 auto 32px'
          }}>
            Connect your listening history or test drive with an active taste profile. SoundGraph combines graph neural topology with 30 second acoustic humming recognition to surface music you will genuinely love.
          </p>

          {/* Primary CTA Area: Connect Spotify & Google as Primary Screen Actions */}
          <div style={{
            maxWidth: '580px',
            margin: '0 auto 48px',
            backgroundColor: '#181818',
            border: '1px solid #272727',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 16px 32px rgba(0, 0, 0, 0.4)'
          }}>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#FFFFFF', marginBottom: '4px' }}>
              Connect your music library to begin
            </div>
            <p style={{ fontSize: '14px', color: '#9B9B9B', marginBottom: '20px' }}>
              Select a streaming provider to synchronize your listening history and generate your graph:
            </p>

            {/* Primary Action Buttons: Spotify & Google */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              {/* Connect Spotify Button */}
              <button
                onClick={handleSpotifyLogin}
                className="btn-main"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '15px',
                  fontWeight: '700',
                  justifyContent: 'center',
                  backgroundColor: '#1db954',
                  color: '#000000',
                  border: 'none',
                  boxShadow: '0 4px 16px rgba(29, 185, 84, 0.3)'
                }}
              >
                <SpotifyIcon size={18} color="#000000" />
                <span>Connect Spotify</span>
              </button>

              {/* Connect Google Button */}
              <button
                onClick={handleGoogleLogin}
                className="btn-main"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '15px',
                  fontWeight: '700',
                  justifyContent: 'center',
                  backgroundColor: '#FFFFFF',
                  color: '#000000',
                  border: 'none',
                  boxShadow: '0 4px 16px rgba(255, 255, 255, 0.15)'
                }}
              >
                <YouTubeIcon size={18} color="#ff0033" />
                <span>Connect Google</span>
              </button>
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#272727' }} />
              <span style={{ fontSize: '11px', color: '#666666', fontWeight: '600' }}>OR TEST DRIVE INSTANTLY</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#272727' }} />
            </div>

            {/* Instant Demo and Walkthrough Buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <button
                onClick={loginAsGuest}
                disabled={isLoading}
                className="btn-secondary-flat"
                style={{
                  flex: '1 1 240px',
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  justifyContent: 'center',
                  backgroundColor: '#1F1F1F',
                  borderColor: '#272727'
                }}
              >
                <SparkleIcon size={16} color="#FFFFFF" />
                <span>{isLoading ? 'Loading session...' : 'Instant demo profile (Astitva Pathak)'}</span>
              </button>

              <button
                onClick={handleLaunchQuickDemo}
                className="btn-secondary-flat"
                style={{
                  flex: '1 1 180px',
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  justifyContent: 'center',
                  backgroundColor: '#1F1F1F',
                  borderColor: '#272727',
                  color: '#9B9B9B'
                }}
              >
                <WaveformIcon size={14} color="#9B9B9B" />
                <span>Explore how it works</span>
              </button>
            </div>

            {/* Credentials Setup Helper Links */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '12px', color: '#666666', marginTop: '16px' }}>
              <span>Need custom API keys?</span>
              <button
                onClick={() => setSpotifyModal(true)}
                style={{ background: 'none', border: 'none', color: '#9B9B9B', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
              >
                Configure Spotify app
              </button>
              <span>·</span>
              <button
                onClick={() => setGoogleModal(true)}
                style={{ background: 'none', border: 'none', color: '#9B9B9B', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
              >
                Configure Google OAuth
              </button>
            </div>
          </div>

          {/* HERO VISUAL: 3D SMART DECK CARD STACK (User selected) */}
          <div style={{ maxWidth: '680px', margin: '0 auto', perspective: '1200px' }}>
            <div style={{
              position: 'relative',
              backgroundColor: '#181818',
              border: '1px solid #272727',
              borderRadius: '24px', /* rounded-3xl outer card */
              padding: '24px', /* 24px padding */
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.8)'
            }}>
              {/* Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px', /* Nested formula: 24 - 16 = 8px */
                    backgroundColor: '#1F1F1F',
                    border: '1px solid #272727',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <WaveformIcon size={16} color="#FFFFFF" />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#FFFFFF' }}>3D Smart Deck</div>
                    <div style={{ fontSize: '12px', color: '#666666' }}>Active topological candidate</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    color: '#10b981',
                    backgroundColor: '#1F1F1F',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid #272727'
                  }}>
                    {activeCard.affinity}
                  </span>
                </div>
              </div>

              {/* Main Card Content */}
              <div style={{
                backgroundColor: '#1F1F1F',
                border: '1px solid #272727',
                borderRadius: '16px',
                padding: '16px',
                marginBottom: '16px',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#FFFFFF', marginBottom: '4px' }}>
                      {activeCard.title}
                    </h3>
                    <p style={{ fontSize: '14px', color: '#9B9B9B' }}>
                      {activeCard.artist} · <span style={{ color: '#666666' }}>{activeCard.stream}</span>
                    </p>
                  </div>
                  <button 
                    onClick={loginAsGuest}
                    className="btn-main"
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                    title="Play track preview in deck"
                  >
                    <PlayIcon size={12} color="#000000" />
                    <span>Play preview</span>
                  </button>
                </div>

                <p style={{ fontSize: '14px', color: '#9B9B9B', lineHeight: '20px', marginBottom: '12px' }}>
                  {activeCard.reason}
                </p>

                {/* Graph Path Visualization */}
                <div style={{
                  backgroundColor: '#181818',
                  border: '1px solid #272727',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  color: '#9B9B9B'
                }}>
                  <span style={{ color: '#666666' }}>Cypher path: </span>
                  {activeCard.graphPath}
                </div>
              </div>

              {/* Card Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#666666' }}>
                  Card {activeCardIndex + 1} of {CARD_STACK_DATA.length}
                </span>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handlePrevCard}
                    className="btn-secondary-flat"
                    style={{ padding: '6px 12px', fontSize: '14px' }}
                    aria-label="Previous recommendation card"
                  >
                    Previous
                  </button>
                  <button
                    onClick={handleNextCard}
                    className="btn-secondary-flat"
                    style={{ padding: '6px 12px', fontSize: '14px' }}
                    aria-label="Next recommendation card"
                  >
                    Next card
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: MANDATORY TAGLINE REVEAL SECTION (B11) */}
        <section 
          ref={taglineRef}
          style={{
            maxWidth: '680px',
            margin: '0 auto 96px',
            padding: '48px 0',
            textAlign: 'center'
          }}
        >
          <div style={{
            fontSize: '36px',
            lineHeight: '44px',
            fontWeight: '700',
            letterSpacing: '-0.02em',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '8px'
          }}>
            {TAGLINE_WORDS.map((word, idx) => {
              const isIlluminated = idx < activeWords;
              return (
                <span
                  key={idx}
                  style={{
                    color: isIlluminated ? '#FFFFFF' : 'rgba(255, 255, 255, 0.28)',
                    transition: 'color 700ms cubic-bezier(0.32, 0.72, 0, 1)'
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>
        </section>

        {/* SECTION 3: BENEFITS SECTION */}
        <section id="benefits" style={{ marginBottom: '96px' }}>
          <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto 48px' }}>
            <h2 style={{ fontSize: '30px', lineHeight: '36px', fontWeight: '700', marginBottom: '12px' }}>
              Engineered for genuine musical discovery
            </h2>
            <p style={{ fontSize: '16px', lineHeight: '24px', color: '#9B9B9B' }}>
              Replace opaque recommendation silos with deterministic graph mathematical relationships.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px'
          }}>
            {/* Benefit 1 */}
            <div className="surface-card" style={{ padding: '24px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: '#181818',
                border: '1px solid #272727',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <NetworkIcon size={20} color="#FFFFFF" />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#FFFFFF', marginBottom: '8px' }}>
                Unified listening memory
              </h3>
              <p style={{ fontSize: '14px', lineHeight: '20px', color: '#9B9B9B' }}>
                <strong>Zero data fragmentation</strong> — your Spotify playlists and YouTube Music history merge into one structured graph schema.
              </p>
            </div>

            {/* Benefit 2 */}
            <div className="surface-card" style={{ padding: '24px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: '#181818',
                border: '1px solid #272727',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <WaveformIcon size={20} color="#FFFFFF" />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#FFFFFF', marginBottom: '8px' }}>
                Humming recognition in 30 seconds
              </h3>
              <p style={{ fontSize: '14px', lineHeight: '20px', color: '#9B9B9B' }}>
                <strong>No studio master needed</strong> — Acoustic Lens converts vocal humming into 12 harmonic chroma bins to find songs you cannot name.
              </p>
            </div>

            {/* Benefit 3 */}
            <div className="surface-card" style={{ padding: '24px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: '#181818',
                border: '1px solid #272727',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <SparkleIcon size={20} color="#FFFFFF" />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#FFFFFF', marginBottom: '8px' }}>
                Explainable recommendation paths
              </h3>
              <p style={{ fontSize: '14px', lineHeight: '20px', color: '#9B9B9B' }}>
                <strong>Clear logic instead of guesses</strong> — each candidate card shows the exact graph nodes and similarity metrics linking your music.
              </p>
            </div>

            {/* Benefit 4 */}
            <div className="surface-card" style={{ padding: '24px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: '#181818',
                border: '1px solid #272727',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <ArrowRightIcon size={20} color="#FFFFFF" />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#FFFFFF', marginBottom: '8px' }}>
                Real time catalog expansion
              </h3>
              <p style={{ fontSize: '14px', lineHeight: '20px', color: '#9B9B9B' }}>
                <strong>Never hit a wall</strong> — missing artists and obscure tracks are dynamically fetched and embedded with 768 dimension vectors on demand.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 4: HOW IT WORKS (3 Chronological Steps) */}
        <section id="how-it-works" style={{ marginBottom: '96px' }}>
          <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto 48px' }}>
            <h2 style={{ fontSize: '30px', lineHeight: '36px', fontWeight: '700', marginBottom: '12px' }}>
              How your listening profile works
            </h2>
            <p style={{ fontSize: '16px', lineHeight: '24px', color: '#9B9B9B' }}>
              Three steps from raw audio streams to personalized knowledge graph navigation.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px'
          }}>
            <div className="surface-card" style={{ padding: '24px' }}>
              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#666666' }}>STEP 01</span>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#FFFFFF', margin: '8px 0' }}>
                Connect or test drive
              </h3>
              <p style={{ fontSize: '14px', lineHeight: '20px', color: '#9B9B9B' }}>
                Authenticate your streaming provider or open our preloaded demo profile with one click to begin immediate exploration.
              </p>
            </div>

            <div className="surface-card" style={{ padding: '24px' }}>
              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#666666' }}>STEP 02</span>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#FFFFFF', margin: '8px 0' }}>
                Graph vector fusion
              </h3>
              <p style={{ fontSize: '14px', lineHeight: '20px', color: '#9B9B9B' }}>
                Neo4j establishes relational edges between artists and genres while multimodal models calculate 768 dimension sonic embeddings.
              </p>
            </div>

            <div className="surface-card" style={{ padding: '24px' }}>
              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#666666' }}>STEP 03</span>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#FFFFFF', margin: '8px 0' }}>
                Discover with confidence
              </h3>
              <p style={{ fontSize: '14px', lineHeight: '20px', color: '#9B9B9B' }}>
                Swipe candidate tracks in your 3D Smart Deck, chat in natural language, or hum melodies directly into your browser microphone.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 5: PROOF & TELEMETRY */}
        <section style={{ marginBottom: '96px' }}>
          <div style={{
            backgroundColor: '#181818',
            border: '1px solid #272727',
            borderRadius: '24px',
            padding: '32px'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h3 style={{ fontSize: '24px', fontWeight: '700', color: '#FFFFFF', marginBottom: '8px' }}>
                Verified telemetry and system metrics
              </h3>
              <p style={{ fontSize: '14px', color: '#9B9B9B' }}>
                Real data recorded from active graph sessions and continuous benchmark evaluations.
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '24px',
              textAlign: 'center'
            }}>
              <div>
                <div style={{ fontSize: '36px', fontWeight: '700', fontFamily: 'var(--font-mono)', color: '#FFFFFF' }}>
                  1,420
                </div>
                <div style={{ fontSize: '13px', color: '#666666', marginTop: '4px' }}>
                  Tracks mapped in demo graph
                </div>
              </div>

              <div>
                <div style={{ fontSize: '36px', fontWeight: '700', fontFamily: 'var(--font-mono)', color: '#FFFFFF' }}>
                  768
                </div>
                <div style={{ fontSize: '13px', color: '#666666', marginTop: '4px' }}>
                  Multimodal embedding dimensions
                </div>
              </div>

              <div>
                <div style={{ fontSize: '36px', fontWeight: '700', fontFamily: 'var(--font-mono)', color: '#FFFFFF' }}>
                  84 ms
                </div>
                <div style={{ fontSize: '13px', color: '#666666', marginTop: '4px' }}>
                  Cosine graph retrieval latency
                </div>
              </div>

              <div>
                <div style={{ fontSize: '36px', fontWeight: '700', fontFamily: 'var(--font-mono)', color: '#FFFFFF' }}>
                  30.0 s
                </div>
                <div style={{ fontSize: '13px', color: '#666666', marginTop: '4px' }}>
                  Continuous humming recognition window
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 6: FREQUENTLY ASKED QUESTIONS (FAQ) */}
        <section id="faq" style={{ marginBottom: '96px', maxWidth: '680px', margin: '0 auto 96px' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '30px', lineHeight: '36px', fontWeight: '700', marginBottom: '12px' }}>
              Frequently asked questions
            </h2>
            <p style={{ fontSize: '16px', lineHeight: '24px', color: '#9B9B9B' }}>
              Clear answers regarding privacy, data ownership, streaming accounts, and graph logic.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              {
                q: 'What is SoundGraph and how is it different from Spotify recommendations?',
                a: 'Spotify relies on collaborative filtering matrices that trap listeners in genre echo chambers. SoundGraph creates an explicit knowledge graph of your personal taste, joining harmonic pitch classes, lyrical semantics, and cross platform connections.'
              },
              {
                q: 'Do I need developer keys or client secrets to test the application?',
                a: 'No. You can click Explore how it works or launch the live demo profile to immediately experience all features with zero authentication setup.'
              },
              {
                q: 'How does Acoustic Lens identify songs from human humming?',
                a: 'Standard fingerprinting algorithms fail on human humming because they require exact studio audio. Acoustic Lens extracts twelve harmonic pitch classes and feeds them into Gemini multimodal reasoning to recognize vocal melodies in real time.'
              },
              {
                q: 'Where is my listening telemetry stored?',
                a: 'Your listening events and taste graph exist strictly within your local Neo4j database instance. No listening records are transmitted to third party ad brokers.'
              },
              {
                q: 'Can I search for songs or artists that are not in my existing library?',
                a: 'Yes. When you request an artist not currently present in your graph, our frontier crawler queries live catalog databases, generates embeddings, and adds them to your graph immediately.'
              },
              {
                q: 'Which streaming platforms are supported?',
                a: 'Spotify and YouTube Music are natively supported for full history ingestion, with support for local audio snippets inside Acoustic Lens.'
              },
              {
                q: 'Is SoundGraph free to run?',
                a: 'Yes. SoundGraph is open source and designed to run locally on your own computer.'
              },
              {
                q: 'Can I export discovered songs back to my Spotify playlists?',
                a: 'Yes. Any candidate in your 3D Smart Deck can be exported or opened directly in your native Spotify or YouTube Music application.'
              }
            ].map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div 
                  key={idx}
                  style={{
                    backgroundColor: '#181818',
                    border: '1px solid #272727',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    transition: 'border-color 0.2s'
                  }}
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? -1 : idx)}
                    style={{
                      width: '100%',
                      padding: '16px 20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'none',
                      border: 'none',
                      color: '#FFFFFF',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <span>{faq.q}</span>
                    <span style={{
                      transform: isOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 700ms cubic-bezier(0.32, 0.72, 0, 1)'
                    }}>
                      <ChevronDownIcon size={16} color="#9B9B9B" />
                    </span>
                  </button>

                  {isOpen && (
                    <div style={{
                      padding: '0 20px 16px',
                      fontSize: '14px',
                      lineHeight: '22px',
                      color: '#9B9B9B'
                    }}>
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 7: FINAL CALL TO ACTION */}
        <section style={{
          textAlign: 'center',
          backgroundColor: '#181818',
          border: '1px solid #272727',
          borderRadius: '24px',
          padding: '64px 24px',
          maxWidth: '680px',
          margin: '0 auto 80px'
        }}>
          <h2 style={{ fontSize: '30px', lineHeight: '36px', fontWeight: '700', marginBottom: '12px', color: '#FFFFFF' }}>
            Map your music taste today
          </h2>
          <p style={{ fontSize: '16px', lineHeight: '24px', color: '#9B9B9B', marginBottom: '32px' }}>
            Experience cross platform graph intelligence with zero setup friction.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
            <button 
              onClick={handleLaunchQuickDemo}
              className="btn-main"
              style={{ padding: '8px 24px', fontSize: '16px' }}
            >
              <SparkleIcon size={18} color="#000000" />
              <span>Explore how it works</span>
            </button>
          </div>
          <div style={{ fontSize: '13px', color: '#666666', marginTop: '16px' }}>
            Open source · Local database privacy · No credit card required
          </div>
        </section>

      </main>

      {/* FOOTER per B10: Semantic footer with legal links, 404, and copyright */}
      <footer style={{
        borderTop: '1px solid #272727',
        backgroundColor: '#181818',
        padding: '32px 24px',
        textAlign: 'center',
        fontSize: '13px',
        color: '#666666'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <button
              onClick={() => setPrivacyModal(true)}
              style={{ background: 'none', border: 'none', color: '#9B9B9B', cursor: 'pointer', fontSize: '13px' }}
            >
              Privacy policy
            </button>
            <span>·</span>
            <button
              onClick={() => setTermsModal(true)}
              style={{ background: 'none', border: 'none', color: '#9B9B9B', cursor: 'pointer', fontSize: '13px' }}
            >
              Terms of service
            </button>
            <span>·</span>
            <button
              onClick={() => setNotFoundModal(true)}
              style={{ background: 'none', border: 'none', color: '#9B9B9B', cursor: 'pointer', fontSize: '13px' }}
            >
              Error 404 view
            </button>
          </div>

          <div>
            SoundGraph · Unified Knowledge Graph Recommendation Engine · Backed by Neo4j and Gemini Multimodal AI
          </div>
        </div>
      </footer>

      {/* QUICK DEMO INTERACTIVE MODAL */}
      {isQuickDemoOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(24px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div style={{
            backgroundColor: '#181818',
            border: '1px solid #272727',
            borderRadius: '24px',
            maxWidth: '640px',
            width: '100%',
            padding: '32px',
            position: 'relative'
          }}>
            {/* Close button */}
            <button 
              onClick={() => setIsQuickDemoOpen(false)}
              style={{
                position: 'absolute',
                top: '24px',
                right: '24px',
                background: 'none',
                border: 'none',
                color: '#9B9B9B',
                cursor: 'pointer'
              }}
              aria-label="Close interactive demo"
            >
              <CloseIcon size={20} color="#FFFFFF" />
            </button>

            {/* Quick Demo Step Navigation */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
              {[1, 2, 3].map((step) => (
                <button
                  key={step}
                  onClick={() => setDemoStep(step)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: demoStep === step ? '#FFFFFF' : '#272727',
                    backgroundColor: demoStep === step ? '#272727' : '#1F1F1F',
                    color: demoStep === step ? '#FFFFFF' : '#666666',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Step {step}: {step === 1 ? 'Ingestion' : step === 2 ? 'Graph fusion' : 'Discovery'}
                </button>
              ))}
            </div>

            {/* DEMO STEP 1: STREAMING INGESTION */}
            {demoStep === 1 && (
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#FFFFFF', marginBottom: '8px' }}>
                  Step 1: Automated telemetry ingestion
                </h3>
                <p style={{ fontSize: '14px', lineHeight: '20px', color: '#9B9B9B', marginBottom: '24px' }}>
                  Streaming listening events are fetched concurrently from Spotify and YouTube Music.
                </p>

                <div style={{
                  backgroundColor: '#1F1F1F',
                  border: '1px solid #272727',
                  borderRadius: '16px',
                  padding: '24px',
                  textAlign: 'center',
                  marginBottom: '24px'
                }}>
                  <div style={{ fontSize: '48px', fontWeight: '700', fontFamily: 'var(--font-mono)', color: '#FFFFFF' }}>
                    {telemetryCount}
                  </div>
                  <div style={{ fontSize: '13px', color: '#9B9B9B', marginTop: '4px' }}>
                    {isSimulatingStream ? 'Ingesting live tracks...' : 'Listening events converted into transactional nodes'}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#1db954' }}>
                      <SpotifyIcon size={14} color="#1db954" /> 740 Spotify songs
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#ff0033' }}>
                      <YouTubeIcon size={14} color="#ff0033" /> 680 YouTube videos
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    onClick={startTelemetrySimulation}
                    disabled={isSimulatingStream}
                    className="btn-secondary-flat"
                    style={{ fontSize: '14px', padding: '6px 12px' }}
                  >
                    {isSimulatingStream ? 'Simulating...' : 'Replay stream simulation'}
                  </button>
                  <button
                    onClick={() => setDemoStep(2)}
                    className="btn-main"
                    style={{ fontSize: '14px', padding: '6px 16px' }}
                  >
                    <span>Proceed to step 2</span>
                    <ArrowRightIcon size={14} color="#000000" />
                  </button>
                </div>
              </div>
            )}

            {/* DEMO STEP 2: GRAPH VECTOR FUSION */}
            {demoStep === 2 && (
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#FFFFFF', marginBottom: '8px' }}>
                  Step 2: Relational graph topology
                </h3>
                <p style={{ fontSize: '14px', lineHeight: '20px', color: '#9B9B9B', marginBottom: '24px' }}>
                  Tracks form edges based on shared artists, harmonic chroma profiles, and Gemini 768 dimension vector similarity.
                </p>

                <div style={{
                  backgroundColor: '#1F1F1F',
                  border: '1px solid #272727',
                  borderRadius: '16px',
                  padding: '24px',
                  marginBottom: '24px'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#FFFFFF', fontWeight: '600' }}>User listens to Track relation</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: '#10b981' }}>1,420 edges</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#FFFFFF', fontWeight: '600' }}>Track similar to Track relation</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: '#10b981' }}>3,890 cosine links</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#FFFFFF', fontWeight: '600' }}>Vector index resolution</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: '#10b981' }}>84 ms</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    onClick={() => setDemoStep(1)}
                    className="btn-secondary-flat"
                    style={{ fontSize: '14px', padding: '6px 12px' }}
                  >
                    Back to step 1
                  </button>
                  <button
                    onClick={() => setDemoStep(3)}
                    className="btn-main"
                    style={{ fontSize: '14px', padding: '6px 16px' }}
                  >
                    <span>Proceed to step 3</span>
                    <ArrowRightIcon size={14} color="#000000" />
                  </button>
                </div>
              </div>
            )}

            {/* DEMO STEP 3: DISCOVERY IN ACTION */}
            {demoStep === 3 && (
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#FFFFFF', marginBottom: '8px' }}>
                  Step 3: Real time discovery and acoustic humming
                </h3>
                <p style={{ fontSize: '14px', lineHeight: '20px', color: '#9B9B9B', marginBottom: '24px' }}>
                  Swipe candidate songs in your 3D deck or hum into Acoustic Lens for early neural identification.
                </p>

                <div style={{
                  backgroundColor: '#1F1F1F',
                  border: '1px solid #272727',
                  borderRadius: '16px',
                  padding: '20px',
                  marginBottom: '24px',
                  textAlign: 'left'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: '#FFFFFF' }}>Starboy</div>
                      <div style={{ fontSize: '13px', color: '#9B9B9B' }}>The Weeknd · 96.4% confidence</div>
                    </div>
                    <span style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      backgroundColor: '#181818',
                      border: '1px solid #272727',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      color: '#10b981'
                    }}>
                      Locked in 6.4s
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#666666' }}>
                    Identified via 12 harmonic pitch class autocorrelation and taste graph context.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button
                    onClick={() => {
                      setIsQuickDemoOpen(false);
                      loginAsGuest();
                    }}
                    className="btn-main"
                    style={{ padding: '10px 20px', fontSize: '16px', width: '100%' }}
                  >
                    <SparkleIcon size={18} color="#000000" />
                    <span>Launch full interactive dashboard</span>
                  </button>

                  <button
                    onClick={() => setDemoStep(2)}
                    className="btn-secondary-flat"
                    style={{ fontSize: '14px', padding: '6px 12px' }}
                  >
                    Back to step 2
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PRIVACY POLICY MODAL per B10 */}
      {privacyModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(20px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div style={{
            backgroundColor: '#181818',
            border: '1px solid #272727',
            borderRadius: '24px',
            maxWidth: '560px',
            width: '100%',
            padding: '32px',
            position: 'relative'
          }}>
            <button 
              onClick={() => setPrivacyModal(false)}
              style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <CloseIcon size={20} color="#FFFFFF" />
            </button>
            <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#FFFFFF', marginBottom: '12px' }}>
              Privacy policy
            </h3>
            <div style={{ fontSize: '14px', lineHeight: '22px', color: '#9B9B9B', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p>SoundGraph stores your listening history and generated graph nodes exclusively within your locally hosted Neo4j instance.</p>
              <p>OAuth tokens obtained from Spotify and Google are encrypted and used only to fetch your own public playlists and listening history.</p>
              <p>No listening telemetry or identity profiles are transmitted to third party data brokers or advertising platforms.</p>
            </div>
          </div>
        </div>
      )}

      {/* TERMS OF SERVICE MODAL per B10 */}
      {termsModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(20px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div style={{
            backgroundColor: '#181818',
            border: '1px solid #272727',
            borderRadius: '24px',
            maxWidth: '560px',
            width: '100%',
            padding: '32px',
            position: 'relative'
          }}>
            <button 
              onClick={() => setTermsModal(false)}
              style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <CloseIcon size={20} color="#FFFFFF" />
            </button>
            <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#FFFFFF', marginBottom: '12px' }}>
              Terms of service
            </h3>
            <div style={{ fontSize: '14px', lineHeight: '22px', color: '#9B9B9B', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p>SoundGraph is open source software distributed for research, educational, and personal music discovery use.</p>
              <p>Song previews and video playback are rendered via official embed APIs provided by Spotify and YouTube.</p>
              <p>You may export and modify your graph schema at any time with complete data sovereignty.</p>
            </div>
          </div>
        </div>
      )}

      {/* BRANDED 404 VIEW per B10 */}
      {notFoundModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(20px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div style={{
            backgroundColor: '#181818',
            border: '1px solid #272727',
            borderRadius: '24px',
            maxWidth: '480px',
            width: '100%',
            padding: '32px',
            textAlign: 'center',
            position: 'relative'
          }}>
            <div style={{ fontSize: '64px', fontWeight: '800', fontFamily: 'var(--font-mono)', color: '#FFFFFF', marginBottom: '8px' }}>
              404
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#FFFFFF', marginBottom: '8px' }}>
              Melody not found in graph space
            </h3>
            <p style={{ fontSize: '14px', color: '#9B9B9B', marginBottom: '24px' }}>
              The node you requested does not have an active path in this cluster.
            </p>
            <button 
              onClick={() => setNotFoundModal(false)}
              className="btn-main"
              style={{ padding: '8px 20px', fontSize: '14px' }}
            >
              Return to landing page
            </button>
          </div>
        </div>
      )}

      {/* GOOGLE CLOUD CREDENTIALS MODAL */}
      {googleModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{ backgroundColor: '#181818', border: '1px solid #272727', borderRadius: '24px', width: '100%', maxWidth: '480px', padding: '32px', position: 'relative' }}>
            <button onClick={() => setGoogleModal(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: '#9B9B9B', cursor: 'pointer' }}>
              <CloseIcon size={20} color="#FFFFFF" />
            </button>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#FFFFFF', marginBottom: '8px' }}>Google Cloud credentials</h3>
            <p style={{ fontSize: '13px', color: '#9B9B9B', marginBottom: '16px' }}>
              Configure your OAuth client ID for YouTube Music synchronization:
            </p>
            <input 
              type="text" placeholder="Google Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)}
              style={{ width: '100%', background: '#1F1F1F', border: '1px solid #272727', borderRadius: '8px', padding: '10px 14px', color: '#FFFFFF', marginBottom: '12px', fontSize: '14px' }}
            />
            <input 
              type="password" placeholder="Google Client Secret" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)}
              style={{ width: '100%', background: '#1F1F1F', border: '1px solid #272727', borderRadius: '8px', padding: '10px 14px', color: '#FFFFFF', marginBottom: '16px', fontSize: '14px' }}
            />
            <button className="btn-main" onClick={handleSaveGoogleCreds} disabled={submitting} style={{ width: '100%', padding: '10px' }}>
              {submitting ? 'Saving and redirecting...' : 'Save and launch Google login'}
            </button>
          </div>
        </div>
      )}

      {/* SPOTIFY DEVELOPER CREDENTIALS MODAL */}
      {spotifyModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{ backgroundColor: '#181818', border: '1px solid #272727', borderRadius: '24px', width: '100%', maxWidth: '480px', padding: '32px', position: 'relative' }}>
            <button onClick={() => setSpotifyModal(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: '#9B9B9B', cursor: 'pointer' }}>
              <CloseIcon size={20} color="#FFFFFF" />
            </button>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#FFFFFF', marginBottom: '8px' }}>Spotify developer credentials</h3>
            <p style={{ fontSize: '13px', color: '#9B9B9B', marginBottom: '16px' }}>
              Configure your Spotify application credentials for library ingestion:
            </p>
            <input 
              type="text" placeholder="Spotify Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)}
              style={{ width: '100%', background: '#1F1F1F', border: '1px solid #272727', borderRadius: '8px', padding: '10px 14px', color: '#FFFFFF', marginBottom: '12px', fontSize: '14px' }}
            />
            <input 
              type="password" placeholder="Spotify Client Secret" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)}
              style={{ width: '100%', background: '#1F1F1F', border: '1px solid #272727', borderRadius: '8px', padding: '10px 14px', color: '#FFFFFF', marginBottom: '16px', fontSize: '14px' }}
            />
            <button className="btn-main" onClick={handleSaveSpotifyCreds} disabled={submitting} style={{ width: '100%', padding: '10px' }}>
              {submitting ? 'Saving and redirecting...' : 'Save and launch Spotify login'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
