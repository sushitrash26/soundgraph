import React, { useEffect } from 'react';
import { useStore } from '../store/useStore';
import CardDeck3D from '../components/CardDeck3D';
import LibraryDrawer from '../components/LibraryDrawer';
import MoodChatModal from '../components/MoodChatModal';
import { Sparkles, RefreshCw, MessageSquare, Compass, Radio } from 'lucide-react';

export default function Dashboard() {
  const { 
    recommendations, 
    fetchRecommendations, 
    fetchLibrary,
    fetchTasteProfile,
    tasteProfile,
    topArtists,
    fetchTopArtists,
    toggleChat,
    statusMessage,
    user
  } = useStore();

  useEffect(() => {
    fetchTasteProfile();
    fetchRecommendations(true);
    fetchLibrary();
    fetchTopArtists();
  }, []);

  const coreArtists = (tasteProfile?.top_artists && tasteProfile.top_artists.length > 0)
    ? tasteProfile.top_artists
    : topArtists;

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '32px 24px' }}>
      <MoodChatModal />

      {/* Top Banner Status Bar */}
      {statusMessage && (
        <div style={{
          marginBottom: '24px',
          padding: '12px 18px',
          borderRadius: '12px',
          background: '#1F1F1F',
          border: '1px solid #313131',
          color: '#FFFFFF',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Sparkles size={15} color="#a855f7" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Main Commercial Layout: Left Taste Ledger + Right 3D Infinite Deck */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '440px minmax(0, 1fr)',
        gap: '32px',
        alignItems: 'start'
      }}>
        {/* Left Section: Technical Taste Ledger & Ingestion Analytics */}
        <div style={{ position: 'sticky', top: '96px', height: 'calc(100vh - 128px)' }}>
          <LibraryDrawer />
        </div>

        {/* Right Section: Infinite 3D Shuffling Discovery Engine */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Pitch & Overview Surface */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px 28px',
            background: '#181818',
            borderRadius: '24px',
            border: '1px solid #272727',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
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
                color: '#a855f7',
                marginBottom: '8px'
              }}>
                <Radio size={13} /> Personalized Discovery
              </div>
              <h1 style={{
                fontSize: '28px',
                fontWeight: '700',
                background: 'linear-gradient(to right, #FFFFFF 0%, #9B9B9B 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                margin: '0 0 6px',
                letterSpacing: '-0.02em'
              }}>
                Curated Recommendations
              </h1>
              <p style={{ fontSize: '13px', color: '#9B9B9B', margin: 0, maxWidth: '580px' }}>
                Discover music tailored to your streaming taste. Preview 30 second audio clips, swipe right to like, or swipe left to pass.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={toggleChat}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '12px',
                  background: '#FFFFFF',
                  border: 'none',
                  color: '#000000',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s var(--ease-fluid)'
                }}
              >
                <MessageSquare size={14} color="#000000" />
                <span>Ask Vibe AI</span>
              </button>

              <button
                onClick={() => fetchRecommendations(true)}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: '#272727',
                  border: '1px solid #313131',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'all 0.2s var(--ease-fluid)'
                }}
                title="Refresh Recommendations"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {/* 3D Smart Infinite Card Deck Centerpiece */}
          <div style={{
            padding: '32px 24px',
            background: '#181818',
            borderRadius: '24px',
            border: '1px solid #272727',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
          }}>
            <CardDeck3D />
          </div>

          {/* Bottom Discovery Shelf: Core Taste Anchors (Graph PageRank Centrality) */}
          {coreArtists && coreArtists.length > 0 && (
            <div style={{
              background: '#181818',
              borderRadius: '24px',
              border: '1px solid #272727',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Compass size={18} color="#a855f7" />
                  <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#FFFFFF', margin: 0, letterSpacing: '-0.02em' }}>
                    Favorite Artists
                  </h3>
                </div>
                <span style={{ fontSize: '12px', color: '#9B9B9B' }}>
                  Most played and connected artists across your library
                </span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '12px'
              }}>
                {coreArtists.slice(0, 6).map((art, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '14px',
                      background: '#1F1F1F',
                      border: '1px solid #272727',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'all 0.2s var(--ease-fluid)'
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {art.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#a855f7' }}>
                      {art.genres ? art.genres.slice(0, 2).join(' · ') : 'Artist'}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: '#9B9B9B',
                      marginTop: '4px'
                    }}>
                      Top Artist
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
