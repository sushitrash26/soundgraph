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
  ChevronRight, 
  Layers, 
  Radio, 
  Zap, 
  Compass, 
  Share2,
  Volume2
} from 'lucide-react';

const SpotifyIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#1DB954" style={{ flexShrink: 0 }}>
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const YouTubeIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#FF0000" style={{ flexShrink: 0 }}>
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const COVERS = [
  'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&auto=format&fit=crop&q=80',
];

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
    setDeckMoodFilter
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

  // Keyboard navigation shortcuts
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
          if (currentTrack?.id === (currentCard.track_id || currentCard.id) && isPlaying) {
            setIsPlaying(false);
          } else {
            playTrack({ ...currentCard, name: currentCard.track_name || currentCard.name, track_id: currentCard.track_id || currentCard.id });
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
          Generating Graph Recommendations
        </h3>
        <p style={{ fontSize: '13px', color: '#9B9B9B', maxWidth: '380px', margin: '0 auto 20px' }}>
          Querying Neo4j HNSW vector indices across your Spotify and YouTube taste personas.
        </p>
        <button
          onClick={() => fetchMoreRecommendations()}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            background: '#272727',
            border: '1px solid #313131',
            color: '#FFFFFF',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Stream Recommendations
        </button>
      </div>
    );
  }

  const visibleCards = recommendations.slice(0, 3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Mood Steering Filter Bar */}
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
            Steer Recommendation Flow
          </span>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: null, label: 'Omni Vector' },
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
                  padding: '6px 12px',
                  borderRadius: '8px',
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

      {/* 3D Infinite Levitating Deck Container */}
      <div 
        style={{
          position: 'relative',
          height: '540px',
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
          const coverArt = card.cover_url || COVERS[index % COVERS.length];

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
            transformStyle = `translate3d(0px, 18px, -40px) scale(0.94)`;
            opacity = 0.85;
          } else if (index === 2) {
            transformStyle = `translate3d(0px, 36px, -80px) scale(0.88)`;
            opacity = 0.65;
          }

          return (
            <div
              key={trackId}
              style={{
                position: 'absolute',
                width: '100%',
                maxWidth: '460px',
                height: '520px',
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
                height: '240px',
                width: '100%',
                overflow: 'hidden',
                background: '#181818'
              }}>
                <img
                  src={coverArt}
                  alt={card.track_name || card.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    filter: 'brightness(0.9)'
                  }}
                  draggable={false}
                />
                
                {/* Surface Vignette Overlay */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(31,31,31,0.95) 100%)'
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
                    <span>{card.source === 'spotify' ? 'Spotify Catalog' : 'YouTube Music'}</span>
                  </div>

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

                {/* Swipe Direction Drag Stamp Indicator */}
                {isTop && isDragging && dragOffset.x > 30 && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '24px',
                    transform: 'translateY(-50%) rotate(-15deg)',
                    padding: '8px 16px',
                    borderRadius: '12px',
                    background: 'rgba(16, 185, 129, 0.9)',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    fontWeight: '700',
                    letterSpacing: '0.05em'
                  }}>
                    LIKE (+1.0)
                  </div>
                )}
                {isTop && isDragging && dragOffset.x < -30 && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    right: '24px',
                    transform: 'translateY(-50%) rotate(15deg)',
                    padding: '8px 16px',
                    borderRadius: '12px',
                    background: 'rgba(239, 68, 68, 0.9)',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    fontWeight: '700',
                    letterSpacing: '0.05em'
                  }}>
                    PASS (-1.0)
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <h3 style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      letterSpacing: '-0.02em',
                      color: '#FFFFFF',
                      margin: 0,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '300px'
                    }}>
                      {card.track_name || card.name}
                    </h3>

                    {/* Bandit Policy Arm Tag */}
                    <span style={{
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: '#272727',
                      color: '#9B9B9B'
                    }}>
                      {card.arm_name || 'linucb'}
                    </span>
                  </div>

                  <div style={{ fontSize: '13px', color: '#9B9B9B', marginBottom: '12px' }}>
                    {(card.artists || []).join(', ') || 'Various Artists'}
                  </div>

                  {/* Explainable Graph-RAG Path */}
                  <div style={{
                    padding: '10px 14px',
                    background: '#181818',
                    border: '1px solid #272727',
                    borderRadius: '10px',
                    fontSize: '12px',
                    color: '#9B9B9B',
                    lineHeight: '18px',
                    marginBottom: '16px'
                  }}>
                    <span style={{ color: '#a855f7', fontWeight: '600' }}>Graph Topology: </span>
                    {card.reason || 'Curated via 768-D multi-centroid latent space traversal.'}
                  </div>

                  {/* Latent Vectors Gauges */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    <div style={{ background: '#181818', padding: '6px 10px', borderRadius: '8px', border: '1px solid #272727' }}>
                      <div style={{ fontSize: '10px', color: '#9B9B9B' }}>Energy</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: '600', color: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>
                        {Math.round((card.energy || 0.65) * 100)}%
                      </div>
                    </div>
                    <div style={{ background: '#181818', padding: '6px 10px', borderRadius: '8px', border: '1px solid #272727' }}>
                      <div style={{ fontSize: '10px', color: '#9B9B9B' }}>Valence</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: '600', color: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>
                        {Math.round((card.valence || 0.55) * 100)}%
                      </div>
                    </div>
                    <div style={{ background: '#181818', padding: '6px 10px', borderRadius: '8px', border: '1px solid #272727' }}>
                      <div style={{ fontSize: '10px', color: '#9B9B9B' }}>Dance</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: '600', color: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>
                        {Math.round((card.danceability || 0.60) * 100)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Primary Card Actions */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '16px',
                  borderTop: '1px solid #272727'
                }}>
                  {/* Dislike Button */}
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
                    title="Dislike (-1.0)"
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
                        playTrack({ ...card, name: card.track_name || card.name, track_id: trackId });
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 20px',
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

                  {/* External Stream Link */}
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
                    title="Listen on Streaming App"
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
                    title="Like (+1.0)"
                  >
                    <Heart size={18} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Deck Controls and Hotkeys Guide */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 18px',
        background: '#181818',
        borderRadius: '14px',
        border: '1px solid #272727',
        fontSize: '12px',
        color: '#9B9B9B'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span>
            <strong style={{ color: '#FFFFFF' }}>Hotkeys:</strong>
          </span>
          <span>
            <kbd style={{ padding: '2px 6px', background: '#272727', borderRadius: '4px', color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>←</kbd> Dislike
          </span>
          <span>
            <kbd style={{ padding: '2px 6px', background: '#272727', borderRadius: '4px', color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>→</kbd> Like
          </span>
          <span>
            <kbd style={{ padding: '2px 6px', background: '#272727', borderRadius: '4px', color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>Space</kbd> Preview
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isDeckLoadingMore ? (
            <span style={{ color: '#a855f7', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
              Polling Graph-RAG buffer...
            </span>
          ) : (
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#666666' }}>
              Buffer: {recommendations.length} infinite cards
            </span>
          )}
        </div>
      </div>

    </div>
  );
}
