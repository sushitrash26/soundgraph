import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import CardDeck3D from '../components/CardDeck3D';
import LibraryDrawer from '../components/LibraryDrawer';
import MoodChatModal from '../components/MoodChatModal';
import { Sparkles, RefreshCw, MessageSquare, Flame, Music, Radio, Compass, Play } from 'lucide-react';

export default function Dashboard() {
  const { 
    recommendations, 
    fetchRecommendations, 
    fetchLibrary,
    topArtists,
    fetchTopArtists,
    toggleChat,
    statusMessage,
    user
  } = useStore();

  const [activeDeckFilter, setActiveDeckFilter] = useState('all');

  useEffect(() => {
    fetchRecommendations();
    fetchLibrary();
    fetchTopArtists();
  }, []);

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '32px 24px' }}>
      <MoodChatModal />

      {/* Top Banner Status Bar */}
      {statusMessage && (
        <div style={{
          marginBottom: '20px',
          padding: '10px 18px',
          borderRadius: '12px',
          background: 'rgba(168, 85, 247, 0.1)',
          border: '1px solid rgba(168, 85, 247, 0.25)',
          color: '#e9d5ff',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Sparkles size={15} color="#c084fc" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Main Commercial Layout: Left Library + Right 3D Experience */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '360px minmax(0, 1fr)',
        gap: '32px',
        alignItems: 'start'
      }}>
        {/* Left Section: Real Ingested Telemetry Drawer */}
        <div style={{ position: 'sticky', top: '90px', height: 'calc(100vh - 120px)' }}>
          <LibraryDrawer />
        </div>

        {/* Right Section: Awwwards 3D Card Deck & Discovery Engine */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Hero Pitch Banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px 28px',
            background: 'linear-gradient(135deg, rgba(28, 28, 38, 0.7) 0%, rgba(18, 18, 24, 0.9) 100%)',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.5)'
          }}>
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#c084fc',
                marginBottom: '8px'
              }}>
                <Sparkles size={13} /> Graph-RLHF Discovery Multiverse
              </div>
              <h1 style={{
                fontSize: '28px',
                fontWeight: '800',
                color: '#fff',
                fontFamily: 'var(--font-heading)',
                margin: '0 0 6px'
              }}>
                Curated Recommendations
              </h1>
              <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: 0 }}>
                Driven by your unified Spotify & YouTube graph topology. Every swipe trains your weights.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={toggleChat}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(168, 85, 247, 0.3)',
                  transition: 'transform 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <MessageSquare size={15} /> Ask Vibe AI
              </button>

              <button
                onClick={fetchRecommendations}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '14px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease'
                }}
                title="Refresh Recommendations"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {/* 3D Smart Card Deck Centerpiece */}
          <div style={{
            padding: '36px 20px',
            background: 'radial-gradient(ellipse at top, rgba(168, 85, 247, 0.08) 0%, rgba(10, 11, 16, 0.6) 70%)',
            borderRadius: '28px',
            border: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            <CardDeck3D />
          </div>

          {/* Bottom Discovery Shelf: High PageRank Taste Influencers */}
          {topArtists && topArtists.length > 0 && (
            <div style={{
              background: 'rgba(20, 20, 28, 0.6)',
              backdropFilter: 'blur(20px)',
              borderRadius: '24px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Compass size={18} color="#06b6d4" />
                  <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#fff', margin: 0 }}>
                    Core Taste Anchors (Graph PageRank Centrality)
                  </h3>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Architectural centers of your combined musical world
                </span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '14px'
              }}>
                {topArtists.slice(0, 6).map((art, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '16px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                      e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>
                      {art.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#06b6d4' }}>
                      {art.genres ? art.genres.slice(0, 2).join(' · ') : 'Artist'}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--text-dim)',
                      marginTop: '4px'
                    }}>
                      Influence Score: {Math.round((art.pagerank || 0.15) * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
