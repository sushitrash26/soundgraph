import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { ThumbsUp, ThumbsDown, ExternalLink, Sparkles, ChevronLeft, ChevronRight, Play, Music } from 'lucide-react';

const SpotifyIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#1DB954">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const YouTubeIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#FF0000">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

// Curated high-res aesthetic music cover art fallback collection
const COVERS = [
  'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
];

export default function CardDeck3D() {
  const { recommendations, sendFeedback } = useStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState(null);

  const cardStartTimeRef = React.useRef(Date.now());

  React.useEffect(() => {
    cardStartTimeRef.current = Date.now();
  }, [currentIndex]);

  if (!recommendations || recommendations.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '60px 20px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '24px',
        border: '1px solid rgba(255,255,255,0.06)'
      }}>
        <Music size={36} color="var(--accent-purple)" style={{ marginBottom: '12px' }} />
        <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', marginBottom: '8px' }}>
          Initializing Your Taste Deck...
        </h3>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
          Connect Spotify or YouTube above to generate your customized 3D music deck.
        </p>
      </div>
    );
  }

  const activeCards = recommendations.slice(currentIndex, currentIndex + 3);
  const currentCard = activeCards[0] || recommendations[0];

  const handleAction = async (reward) => {
    if (!currentCard) return;
    setSwipeDirection(reward > 0 ? 'right' : 'left');
    await sendFeedback(currentCard.track_id || currentCard.id, reward);
    setTimeout(() => {
      setSwipeDirection(null);
      setCurrentIndex((prev) => (prev + 1 >= recommendations.length ? 0 : prev + 1));
    }, 280);
  };

  const handleNext = () => {
    const dwellMs = Date.now() - cardStartTimeRef.current;
    if (dwellMs < 2500 && currentCard) {
      // Rapid skip (< 2.5s) implies disinterest -> soft implicit negative
      sendFeedback(currentCard.track_id || currentCard.id, -0.2);
    } else if (dwellMs > 10000 && currentCard) {
      // Long dwell (> 10s) implies engaged curiosity -> soft implicit positive
      sendFeedback(currentCard.track_id || currentCard.id, 0.3);
    }
    setCurrentIndex((prev) => (prev + 1 >= recommendations.length ? 0 : prev + 1));
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 < 0 ? recommendations.length - 1 : prev - 1));
  };

  const getPlayUrl = (card) => {
    const artist = (card.artists && card.artists[0]) || '';
    const query = encodeURIComponent(`${card.track_name || card.name} ${artist}`);
    if (card.source === 'youtube') {
      return `https://music.youtube.com/search?q=${query}`;
    }
    return `https://open.spotify.com/search/${query}`;
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '520px', margin: '0 auto' }}>
      {/* Deck Controls Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            padding: '4px 10px',
            borderRadius: '999px',
            background: 'rgba(168, 85, 247, 0.15)',
            color: '#c084fc',
            fontWeight: '700',
            border: '1px solid rgba(168, 85, 247, 0.3)'
          }}>
            3D Smart Deck
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {currentIndex + 1} of {recommendations.length}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={handlePrev}
            className="action-btn"
            style={{ width: '36px', height: '36px', borderRadius: '50%', padding: 0 }}
            title="Previous Card"
          >
            <ChevronLeft size={16} />
          </button>
          <button 
            onClick={handleNext}
            className="action-btn"
            style={{ width: '36px', height: '36px', borderRadius: '50%', padding: 0 }}
            title="Next Card"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* 3D Stack Stage */}
      <div style={{
        position: 'relative',
        height: '490px',
        perspective: '1200px',
        perspectiveOrigin: '50% 50%'
      }}>
        {activeCards.map((card, i) => {
          const isTop = i === 0;
          const isSpotify = card.source !== 'youtube';
          const rawId = card.track_id || card.id || '';

          // Authentic dynamic cover art (YouTube official thumbnail or track cover_url)
          let coverImg = card.cover_url || card.image_url;
          if (!coverImg && rawId.includes('youtube:video:')) {
            const vid = rawId.replace('youtube:video:', '');
            coverImg = `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
          } else if (!coverImg && !isSpotify && rawId) {
            coverImg = `https://img.youtube.com/vi/${rawId}/hqdefault.jpg`;
          }
          if (!coverImg) {
            const palettes = [
              'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
            ];
            const hash = (card.track_name || card.name || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
            coverImg = palettes[hash % palettes.length];
          }

          // 3D Stack offsets
          const translateY = i * 16;
          const scale = 1 - i * 0.05;
          const zIndex = 30 - i * 10;
          const opacity = 1 - i * 0.18;

          const swipeTransform = isTop && swipeDirection === 'right'
            ? 'translateX(200px) rotate(15deg) scale(0.95)'
            : isTop && swipeDirection === 'left'
            ? 'translateX(-200px) rotate(-15deg) scale(0.95)'
            : `translateY(${translateY}px) scale(${scale})`;

          return (
            <div
              key={card.track_id || card.id || i}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '460px',
                zIndex,
                opacity,
                transform: swipeTransform,
                transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                pointerEvents: isTop ? 'auto' : 'none',
                background: 'linear-gradient(180deg, rgba(28, 28, 36, 0.95) 0%, rgba(18, 18, 24, 0.98) 100%)',
                borderRadius: '28px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: isTop 
                  ? '0 24px 48px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(168, 85, 247, 0.15)' 
                  : '0 12px 24px -8px rgba(0, 0, 0, 0.5)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Card Visual Header */}
              <div style={{
                position: 'relative',
                height: '210px',
                overflow: 'hidden',
                background: '#0a0a0f'
              }}>
                <img 
                  src={coverImg} 
                  alt={card.track_name || card.name}
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&auto=format&fit=crop&q=80';
                  }}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    filter: 'brightness(0.85) contrast(1.1)'
                  }}
                />
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(18,18,24,0.95) 100%)'
                }} />

                {/* Source Platform Badge */}
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  left: '16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  background: 'rgba(0, 0, 0, 0.65)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#fff'
                }}>
                  {isSpotify ? <SpotifyIcon size={14} /> : <YouTubeIcon size={14} />}
                  <span>{isSpotify ? 'Spotify' : 'YouTube Music'}</span>
                </div>

                {/* Match Score Badge */}
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  background: 'rgba(168, 85, 247, 0.25)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(168, 85, 247, 0.4)',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#e9d5ff'
                }}>
                  <Sparkles size={13} color="#c084fc" />
                  <span>{Math.round((card.score || 0.85) * 100)}% Match</span>
                </div>

                {/* Direct Play Floating Button */}
                <a
                  href={getPlayUrl(card)}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    position: 'absolute',
                    bottom: '16px',
                    right: '16px',
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: isSpotify ? '#1DB954' : '#FF0000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                    color: '#fff',
                    transition: 'transform 0.2s ease',
                    textDecoration: 'none'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  title={`Play on ${isSpotify ? 'Spotify' : 'YouTube'}`}
                >
                  <Play size={20} fill="#fff" style={{ marginLeft: '2px' }} />
                </a>
              </div>

              {/* Card Meta Content */}
              <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: '#fff',
                  marginBottom: '4px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {card.track_name || card.name}
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: 'var(--text-muted)',
                  marginBottom: '16px'
                }}>
                  {(card.artists && card.artists.join(', ')) || 'Featured Artist'}
                </p>

                {/* Graph Reasoning Callout */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  padding: '12px 14px',
                  marginBottom: '16px',
                  flex: 1
                }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: '#c084fc',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '6px'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={12} /> Knowledge Graph Reasoning
                    </span>
                    {card.transition_flow && (
                      <span style={{ color: '#38bdf8', fontSize: '10.5px', textTransform: 'none', fontWeight: '500' }}>
                        🌊 {card.transition_flow}
                      </span>
                    )}
                  </div>
                  <p style={{
                    fontSize: '12.5px',
                    color: '#e2e8f0',
                    lineHeight: '1.5',
                    margin: 0
                  }}>
                    {card.reason || 'Computed topological proximity across your connected music footprint.'}
                  </p>
                </div>

                {/* RLHF Interaction Bar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginTop: 'auto'
                }}>
                  <button
                    onClick={() => handleAction(-1.0)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px',
                      borderRadius: '14px',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#f87171',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.16)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
                    title="Dislike: Prunes this branch from future graph traversals (-1.0 RLHF reward)"
                  >
                    <ThumbsDown size={16} /> Dislike
                  </button>

                  <button
                    onClick={() => handleAction(1.0)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px',
                      borderRadius: '14px',
                      background: 'rgba(34, 197, 94, 0.12)',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      color: '#4ade80',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 4px 16px rgba(34, 197, 94, 0.12)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(34, 197, 94, 0.22)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(34, 197, 94, 0.12)'}
                    title="Love it: Trains graph weights to prioritize this community (+1.0 RLHF reward)"
                  >
                    <ThumbsUp size={16} /> Love It (+1)
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
