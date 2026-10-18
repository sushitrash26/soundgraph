import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { 
  Heart, 
  ThumbsDown, 
  ExternalLink, 
  Sparkles, 
  Play, 
  Pause, 
  Music, 
  RefreshCw,
  Plus
} from 'lucide-react';

const SpotifyIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#1DB954" style={{ flexShrink: 0 }}>
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const YouTubeIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#FF0000" style={{ flexShrink: 0 }}>
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const cleanReason = (reason) => {
  if (!reason) return 'Matches your streaming taste';
  let cleaned = reason
    .replace(/^graph\s+topology\s*:?\s*/i, '')
    .replace(/^spotify\s+catalog\s*:?\s*/i, '')
    .replace(/^youtube\s+music\s*:?\s*/i, '')
    .replace(/^catalog\s+selection\s*:?\s*/i, '')
    .replace(/via\s+768-d\s+latent\s+space/i, '')
    .trim();
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned || 'Matches your streaming taste';
};

export default function CardDeck3D() {
  const { 
    recommendations, 
    sendFeedback, 
    sendDwellTelemetry, 
    playTrack, 
    currentTrack, 
    isPlaying, 
    setIsPlaying,
    fetchMoreRecommendations,
    isDeckLoadingMore,
    deckMoodFilter,
    setDeckMoodFilter,
    setIsAddToDeckOpen
  } = useStore();

  const [swipeDirection, setSwipeDirection] = useState(null); // 'left' | 'right' | null
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const cardStartTimeRef = useRef(Date.now());

  const currentCard = (recommendations && recommendations.length > 0) ? recommendations[0] : null;

  useEffect(() => {
    cardStartTimeRef.current = Date.now();
  }, [currentCard?.track_id || currentCard?.id]);

  // Keyboard navigation shortcuts (functional without cluttering the screen)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.key === 'ArrowRight') {
        handleAction(1.0);
      } else if (e.key === 'ArrowLeft') {
        handleAction(-1.0);
      } else if (e.key === ' ') {
        e.preventDefault();
        if (currentCard) {
          const curId = currentCard.track_id || currentCard.id;
          const playingId = currentTrack?.track_id || currentTrack?.id;
          if (playingId === curId && isPlaying) {
            setIsPlaying(false);
          } else {
            playTrack({ ...currentCard, name: currentCard.track_name || currentCard.name, track_id: curId });
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentCard, currentTrack, isPlaying]);

  const handleAction = async (reward) => {
    if (!currentCard || swipeDirection) return;
    const dwellMs = Date.now() - cardStartTimeRef.current;
    const trackId = currentCard.track_id || currentCard.id;

    setSwipeDirection(reward > 0 ? 'right' : 'left');

    sendDwellTelemetry(trackId, currentCard.bandit_arm || 0, dwellMs, reward);
    await sendFeedback(trackId, reward);

    setTimeout(() => {
      setSwipeDirection(null);
      setDragOffset({ x: 0, y: 0 });
    }, 280);
  };

  const handlePointerDown = (e) => {
    if (e.button !== 0 && e.type !== 'touchstart') return;
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;
    dragStartRef.current = { x: clientX, y: clientY };
    setIsDragging(true);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;
    setDragOffset({ x: dx, y: dy });
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragOffset.x > 90) {
      handleAction(1.0);
    } else if (dragOffset.x < -90) {
      handleAction(-1.0);
    } else {
      setDragOffset({ x: 0, y: 0 });
    }
  };

  const getPlayUrl = (card) => {
    if (!card) return '#';
    const artist = (card.artists && card.artists[0]) || '';
    const query = encodeURIComponent(`${card.track_name || card.name} ${artist}`);
    if (card.source === 'youtube') {
      return `https://music.youtube.com/search?q=${query}`;
    }
    return `https://open.spotify.com/search/${query}`;
  };

  if (!recommendations || recommendations.length === 0) {
    return (
      <div style={{
        minHeight: '520px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        background: '#181818',
        borderRadius: '24px',
        border: '1px solid #272727',
        textAlign: 'center'
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          background: '#272727',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px'
        }}>
          <Music size={28} color="#a855f7" />
        </div>
        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#FFFFFF', marginBottom: '8px' }}>
          Finding Recommendations
        </h3>
        <p style={{ fontSize: '13px', color: '#9B9B9B', maxWidth: '380px', margin: '0 auto 20px' }}>
          Curating tracks tailored to your streaming taste across Spotify and YouTube.
        </p>
        <button
          onClick={() => fetchMoreRecommendations()}
          style={{
            padding: '10px 20px',
            borderRadius: '12px',
            background: '#FFFFFF',
            border: 'none',
            color: '#000000',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Discover More Tracks
        </button>
      </div>
    );
  }

  const visibleCards = recommendations.slice(0, 3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Mood Filter Pills Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '12px 18px',
        background: '#181818',
        borderRadius: '16px',
        border: '1px solid #272727'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={15} color="#a855f7" />
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#FFFFFF' }}>
            Filter by Vibe
          </span>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: null, label: 'All Vibes' },
            { id: 'euphoric', label: 'Euphoric' },
            { id: 'melancholic', label: 'Melancholic' },
            { id: 'chill', label: 'Chill' },
            { id: 'high_energy', label: 'High Energy' }
          ].map(m => {
            const isSelected = deckMoodFilter === m.id;
            return (
              <button
                key={m.label}
                onClick={() => setDeckMoodFilter(m.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '999px',
                  border: '1px solid',
                  borderColor: isSelected ? '#a855f7' : '#272727',
                  background: isSelected ? '#272727' : 'transparent',
                  color: isSelected ? '#FFFFFF' : '#9B9B9B',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s var(--ease-fluid)'
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3D Infinite Deck Container */}
      <div 
        style={{
          position: 'relative',
          height: '520px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          perspective: '1200px',
          userSelect: 'none',
          touchAction: 'none'
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {visibleCards.map((card, index) => {
          const isTop = index === 0;
          const trackId = card.track_id || card.id;
          const isCurrentAudio = (currentTrack?.track_id || currentTrack?.id) === trackId;
          const coverArt = card.cover_url || '';

          // Compute 3D Depth Layering
          let transformStyle = '';
          let opacity = 1;

          if (isTop) {
            const rot = isDragging ? dragOffset.x * 0.08 : (swipeDirection === 'right' ? 14 : swipeDirection === 'left' ? -14 : 0);
            const transX = isDragging ? dragOffset.x : (swipeDirection === 'right' ? 500 : swipeDirection === 'left' ? -500 : 0);
            const transY = isDragging ? dragOffset.y * 0.4 : (swipeDirection ? -40 : 0);
            opacity = swipeDirection ? 0 : 1;
            transformStyle = `translate3d(${transX}px, ${transY}px, 0px) rotate(${rot}deg)`;
          } else if (index === 1) {
            transformStyle = `translate3d(0px, 16px, -40px) scale(0.95)`;
            opacity = 0.85;
          } else if (index === 2) {
            transformStyle = `translate3d(0px, 32px, -80px) scale(0.90)`;
            opacity = 0.65;
          }

          return (
            <div
              key={trackId}
              style={{
                position: 'absolute',
                width: '100%',
                maxWidth: '460px',
                height: '500px',
                background: '#1F1F1F',
                border: '1px solid #272727',
                borderRadius: '24px',
                boxShadow: isTop ? '0 24px 48px rgba(0, 0, 0, 0.7)' : '0 12px 24px rgba(0, 0, 0, 0.4)',
                transform: transformStyle,
                transition: isDragging ? 'none' : 'transform 0.4s var(--ease-fluid), opacity 0.3s ease',
                zIndex: 3 - index,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                cursor: isTop ? (isDragging ? 'grabbing' : 'grab') : 'default',
                pointerEvents: isTop ? 'auto' : 'none'
              }}
            >
              {/* Artwork Cover Header */}
              <div style={{
                position: 'relative',
                height: '250px',
                width: '100%',
                overflow: 'hidden',
                background: '#181818'
              }}>
                {coverArt ? (
                  <img
                    src={coverArt}
                    alt={card.track_name || card.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      filter: 'brightness(0.92)'
                    }}
                    draggable={false}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(135deg, #181818 0%, #272727 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Music size={48} color="#383838" />
                  </div>
                )}
                
                {/* Surface Gradient Overlay */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(31,31,31,0.95) 100%)'
                }} />

                {/* Top Badge Overlay */}
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  left: '16px',
                  right: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.65)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#FFFFFF'
                  }}>
                    {card.source === 'spotify' ? <SpotifyIcon size={14} /> : <YouTubeIcon size={14} />}
                    <span>{card.source === 'spotify' ? 'Spotify' : 'YouTube Music'}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsAddToDeckOpen(true, card);
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '8px',
                        background: 'rgba(0, 0, 0, 0.65)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: '#FFFFFF',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Add to Custom Deck"
                    >
                      <Plus size={13} />
                      <span>Deck</span>
                    </button>

                    <div style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      background: 'rgba(168, 85, 247, 0.25)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(168, 85, 247, 0.4)',
                      fontSize: '12px',
                      fontWeight: '700',
                      fontFamily: 'var(--font-mono)',
                      color: '#e9d5ff',
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      {Math.round((card.score || 0.95) * 100)}% Match
                    </div>
                  </div>
                </div>

                {/* Swipe Direction Drag Stamp Indicator */}
                {isTop && isDragging && dragOffset.x > 30 && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '24px',
                    transform: 'translateY(-50%) rotate(-12deg)',
                    padding: '8px 16px',
                    borderRadius: '12px',
                    background: 'rgba(16, 185, 129, 0.92)',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    fontWeight: '700',
                    letterSpacing: '0.05em'
                  }}>
                    LIKE
                  </div>
                )}
                {isTop && isDragging && dragOffset.x < -30 && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    right: '24px',
                    transform: 'translateY(-50%) rotate(12deg)',
                    padding: '8px 16px',
                    borderRadius: '12px',
                    background: 'rgba(239, 68, 68, 0.92)',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    fontWeight: '700',
                    letterSpacing: '0.05em'
                  }}>
                    PASS
                  </div>
                )}
              </div>

              {/* Card Meta Body */}
              <div style={{
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                justifyContent: 'space-between'
              }}>
                <div>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    letterSpacing: '-0.02em',
                    color: '#FFFFFF',
                    margin: '0 0 6px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {card.track_name || card.name}
                  </h3>

                  <div style={{ fontSize: '13px', color: '#9B9B9B', marginBottom: '14px' }}>
                    {(card.artists || []).join(', ') || 'Various Artists'}
                  </div>

                  {/* Clean Commercial Recommendation Reason */}
                  <div style={{
                    padding: '12px 14px',
                    background: '#181818',
                    border: '1px solid #272727',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#CCCCCC',
                    lineHeight: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '14px'
                  }}>
                    <Sparkles size={14} color="#a855f7" style={{ flexShrink: 0 }} />
                    <span style={{ color: '#FFFFFF', fontWeight: '500' }}>
                      {cleanReason(card.reason)}
                    </span>
                  </div>

                  {/* Genre Tags */}
                  {card.genres && card.genres.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {card.genres.slice(0, 3).map((g, idx) => (
                        <span key={idx} style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: '#181818',
                          border: '1px solid #272727',
                          color: '#9B9B9B'
                        }}>
                          {g}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Primary Card Actions */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '16px',
                  borderTop: '1px solid #272727'
                }}>
                  {/* Dislike / Pass Button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAction(-1.0); }}
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      background: '#181818',
                      border: '1px solid #ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#ef4444',
                      transition: 'all 0.2s var(--ease-fluid)'
                    }}
                    title="Pass track"
                  >
                    <ThumbsDown size={18} />
                  </button>

                  {/* Audio Playback Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isCurrentAudio && isPlaying) {
                        setIsPlaying(false);
                      } else {
                        playTrack({ 
                          ...card, 
                          name: card.track_name || card.name, 
                          track_id: trackId,
                          preview_url: card.preview_url,
                          cover_url: card.cover_url
                        });
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 22px',
                      borderRadius: '12px',
                      background: isCurrentAudio && isPlaying ? '#10b981' : '#FFFFFF',
                      border: 'none',
                      color: isCurrentAudio && isPlaying ? '#FFFFFF' : '#000000',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s var(--ease-fluid)'
                    }}
                  >
                    {isCurrentAudio && isPlaying ? (
                      <>
                        <Pause size={15} fill="#FFFFFF" />
                        <span>Playing</span>
                      </>
                    ) : (
                      <>
                        <Play size={15} fill="#000000" />
                        <span>Preview</span>
                      </>
                    )}
                  </button>

                  {/* External Streaming Link */}
                  <a
                    href={getPlayUrl(card)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      background: '#181818',
                      border: '1px solid #272727',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#9B9B9B',
                      textDecoration: 'none',
                      transition: 'all 0.2s var(--ease-fluid)'
                    }}
                    title="Open on Streaming App"
                  >
                    <ExternalLink size={18} />
                  </a>

                  {/* Like Button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAction(1.0); }}
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      background: '#181818',
                      border: '1px solid #10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#10b981',
                      transition: 'all 0.2s var(--ease-fluid)'
                    }}
                    title="Like track"
                  >
                    <Heart size={18} />
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
