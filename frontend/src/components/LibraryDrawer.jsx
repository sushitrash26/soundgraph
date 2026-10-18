import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { 
  Music, 
  Play, 
  ExternalLink, 
  Sparkles, 
  Filter, 
  Search, 
  Heart, 
  ThumbsDown, 
  Radio, 
  Flame, 
  Layers, 
  Disc, 
  User, 
  BarChart3,
  SlidersHorizontal,
  Clock,
  TrendingUp,
  Volume2
} from 'lucide-react';

const SpotifyIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#1DB954" style={{ flexShrink: 0 }}>
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const YouTubeIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#FF0000" style={{ flexShrink: 0 }}>
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

export default function LibraryDrawer() {
  const { 
    tasteProfile, 
    library, 
    fetchLibrary, 
    fetchTasteProfile, 
    playTrack, 
    currentTrack, 
    isPlaying 
  } = useStore();

  const [activeTab, setActiveTab] = useState('insights'); // 'insights', 'artists', 'playlists', 'tracks'
  const [feedbackSubFilter, setFeedbackSubFilter] = useState('all'); // 'all', 'likes', 'dislikes'
  const [selectedMood, setSelectedMood] = useState('all');
  const [selectedSort, setSelectedSort] = useState('highest_plays');
  const [selectedSource, setSelectedSource] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchTasteProfile();
  }, []);

  useEffect(() => {
    fetchLibrary({
      mood: selectedMood,
      sort: selectedSort,
      source: selectedSource,
      search: searchQuery
    });
  }, [selectedMood, selectedSort, selectedSource, searchQuery]);

  const {
    top_artists = [],
    top_playlists = [],
    likes = [],
    dislikes = [],
    stats = {},
    vector_metrics = {},
    personas = []
  } = tasteProfile || {};

  const filteredFeedbackList = feedbackSubFilter === 'likes' 
    ? likes 
    : feedbackSubFilter === 'dislikes' 
    ? dislikes 
    : [...likes, ...dislikes];

  const getPlayUrl = (item) => {
    const artist = (item.artists && item.artists[0]) || '';
    const q = encodeURIComponent(`${item.title || item.name} ${artist}`);
    if (item.source === 'youtube') {
      return `https://music.youtube.com/search?q=${q}`;
    }
    return `https://open.spotify.com/search/${q}`;
  };

  return (
    <div style={{
      background: '#181818',
      border: '1px solid #272727',
      borderRadius: '24px',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      color: '#FFFFFF'
    }}>
      {/* HUD Telemetry Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '9999px',
              background: '#10b981',
              boxShadow: '0 0 10px #10b981'
            }} />
            <h2 style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '-0.02em', margin: 0 }}>
              Taste Ledger
            </h2>
          </div>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            padding: '4px 8px',
            borderRadius: '6px',
            background: '#272727',
            color: '#9B9B9B',
            fontVariantNumeric: 'tabular-nums'
          }}>
            {stats.total_stream_plays || 0} plays
          </span>
        </div>
        <p style={{ fontSize: '13px', color: '#9B9B9B', margin: 0 }}>
          Real time cross platform analytics ingested directly from your streaming accounts.
        </p>
      </div>

      {/* Latent Vector Coordinates Radar (768-D Vector Projection) */}
      <div style={{
        background: '#1F1F1F',
        border: '1px solid #272727',
        borderRadius: '16px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: '#FFFFFF' }}>
            <BarChart3 size={14} color="#06b6d4" /> Latent Vector Coordinates
          </div>
          <span style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: '#06b6d4',
            fontVariantNumeric: 'tabular-nums'
          }}>
            Gemini 768-D
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {/* Energy */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9B9B9B' }}>
              <span>Energy</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>
                {Math.round((vector_metrics.energy || 0.65) * 100)}%
              </span>
            </div>
            <div style={{ width: '100%', height: '4px', background: '#272727', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.round((vector_metrics.energy || 0.65) * 100)}%`,
                height: '100%',
                background: '#a855f7',
                transition: 'width 0.6s var(--ease-fluid)'
              }} />
            </div>
          </div>

          {/* Valence */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9B9B9B' }}>
              <span>Valence</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>
                {Math.round((vector_metrics.valence || 0.55) * 100)}%
              </span>
            </div>
            <div style={{ width: '100%', height: '4px', background: '#272727', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.round((vector_metrics.valence || 0.55) * 100)}%`,
                height: '100%',
                background: '#06b6d4',
                transition: 'width 0.6s var(--ease-fluid)'
              }} />
            </div>
          </div>

          {/* Danceability */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9B9B9B' }}>
              <span>Danceability</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>
                {Math.round((vector_metrics.danceability || 0.60) * 100)}%
              </span>
            </div>
            <div style={{ width: '100%', height: '4px', background: '#272727', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.round((vector_metrics.danceability || 0.60) * 100)}%`,
                height: '100%',
                background: '#10b981',
                transition: 'width 0.6s var(--ease-fluid)'
              }} />
            </div>
          </div>

          {/* Acousticness */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9B9B9B' }}>
              <span>Acousticness</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>
                {Math.round((vector_metrics.acousticness || 0.20) * 100)}%
              </span>
            </div>
            <div style={{ width: '100%', height: '4px', background: '#272727', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.round((vector_metrics.acousticness || 0.20) * 100)}%`,
                height: '100%',
                background: '#f59e0b',
                transition: 'width 0.6s var(--ease-fluid)'
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Technical Tabs Switcher */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '4px',
        padding: '4px',
        background: '#1F1F1F',
        borderRadius: '12px',
        marginBottom: '16px'
      }}>
        {[
          { id: 'insights', label: 'Insights', icon: Heart },
          { id: 'artists', label: 'Artists', icon: User },
          { id: 'playlists', label: 'Playlists', icon: Disc },
          { id: 'tracks', label: 'Library', icon: Music },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 4px',
                borderRadius: '8px',
                border: 'none',
                background: isActive ? '#272727' : 'transparent',
                color: isActive ? '#FFFFFF' : '#9B9B9B',
                fontSize: '12px',
                fontWeight: isActive ? '600' : '500',
                cursor: 'pointer',
                transition: 'all 0.2s var(--ease-fluid)'
              }}
            >
              <Icon size={13} color={isActive ? '#FFFFFF' : '#9B9B9B'} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content Panels Area */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>

        {/* TAB 1: USER INSIGHTS & REAL-TIME FEEDBACK LEDGER */}
        {activeTab === 'insights' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Feedback Stats Counter */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{
                background: '#1F1F1F',
                border: '1px solid #272727',
                borderRadius: '12px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Heart size={16} color="#10b981" />
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#9B9B9B' }}>Recorded Likes</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: '#FFFFFF' }}>
                    {likes.length}
                  </div>
                </div>
              </div>

              <div style={{
                background: '#1F1F1F',
                border: '1px solid #272727',
                borderRadius: '12px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <ThumbsDown size={16} color="#ef4444" />
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#9B9B9B' }}>Recorded Dislikes</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: '#FFFFFF' }}>
                    {dislikes.length}
                  </div>
                </div>
              </div>
            </div>

            {/* Sub Filter Buttons: All, Likes, Dislikes */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { id: 'all', label: `All Feedback (${likes.length + dislikes.length})` },
                { id: 'likes', label: `Liked (${likes.length})` },
                { id: 'dislikes', label: `Disliked (${dislikes.length})` }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setFeedbackSubFilter(sub.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: feedbackSubFilter === sub.id ? '#FFFFFF' : '#272727',
                    background: feedbackSubFilter === sub.id ? '#272727' : 'transparent',
                    color: feedbackSubFilter === sub.id ? '#FFFFFF' : '#9B9B9B',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s var(--ease-fluid)'
                  }}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {/* Feedback List Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredFeedbackList.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '36px 16px',
                  background: '#1F1F1F',
                  borderRadius: '12px',
                  border: '1px dashed #272727',
                  color: '#9B9B9B'
                }}>
                  <Heart size={24} color="#9B9B9B" style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#FFFFFF', marginBottom: '4px' }}>
                    No Feedback Recorded Yet
                  </div>
                  <p style={{ fontSize: '12px', margin: 0 }}>
                    Swipe right on cards to register likes, or left to register dislikes. Every action updates this ledger.
                  </p>
                </div>
              ) : (
                filteredFeedbackList.map((item, idx) => {
                  const isCurrent = (currentTrack?.track_id || currentTrack?.id) === item.id;
                  const isLiked = (item.reward || 0) > 0;
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 14px',
                        background: isCurrent ? '#272727' : '#1F1F1F',
                        border: '1px solid',
                        borderColor: isCurrent ? '#a855f7' : '#272727',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        transition: 'all 0.2s var(--ease-fluid)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          background: isLiked ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {isLiked ? <Heart size={14} color="#10b981" /> : <ThumbsDown size={14} color="#ef4444" />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontSize: '13px',
                            fontWeight: '600',
                            color: '#FFFFFF',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {item.title}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: '#9B9B9B',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {(item.artists || []).join(', ') || 'Various Artists'}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {item.source === 'spotify' ? <SpotifyIcon size={14} /> : <YouTubeIcon size={14} />}
                        <button
                          onClick={() => playTrack({ ...item, name: item.title, track_id: item.id })}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            background: '#272727',
                            border: '1px solid #313131',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: isCurrent && isPlaying ? '#10b981' : '#FFFFFF',
                            transition: 'all 0.2s var(--ease-fluid)'
                          }}
                          title="Play Track"
                        >
                          <Play size={12} fill={isCurrent && isPlaying ? '#10b981' : 'none'} />
                        </button>
                        <a
                          href={getPlayUrl(item)}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            background: '#272727',
                            border: '1px solid #313131',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#9B9B9B',
                            textDecoration: 'none'
                          }}
                          title="Open Stream"
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 2: TOP ARTISTS FROM INGESTION */}
        {activeTab === 'artists' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {top_artists.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: '#9B9B9B' }}>
                No artists found in database.
              </div>
            ) : (
              top_artists.map((artist, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px 16px',
                    background: '#1F1F1F',
                    border: '1px solid #272727',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      color: '#9B9B9B',
                      width: '20px',
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      #{idx + 1}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#FFFFFF',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {artist.name}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: '#06b6d4',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {(artist.genres || []).slice(0, 2).join(' · ') || 'Artist'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#FFFFFF',
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      {artist.total_plays || artist.track_count || 1} plays
                    </span>
                    <span style={{ fontSize: '10px', color: '#9B9B9B' }}>
                      Graph Centrality: {Math.round((artist.pagerank || 0.15) * 100)}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: TOP PLAYLISTS */}
        {activeTab === 'playlists' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {top_playlists.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: '#9B9B9B' }}>
                No synced playlists found.
              </div>
            ) : (
              top_playlists.map((pl, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#1F1F1F',
                    border: '1px solid #272727',
                    borderRadius: '16px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    transition: 'all 0.2s var(--ease-fluid)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {pl.source === 'spotify' ? <SpotifyIcon size={16} /> : <YouTubeIcon size={16} />}
                      <span style={{ fontSize: '14px', fontWeight: '700', color: '#FFFFFF' }}>
                        {pl.name}
                      </span>
                    </div>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: '#272727',
                      color: '#9B9B9B',
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      {pl.track_count || 0} tracks
                    </span>
                  </div>

                  {pl.description && (
                    <p style={{ fontSize: '12px', color: '#9B9B9B', margin: 0 }}>
                      {pl.description}
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#666666' }}>
                      Topology cluster verified
                    </span>
                    <button
                      onClick={() => fetchLibrary({ source: pl.source })}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        background: '#272727',
                        border: '1px solid #313131',
                        color: '#FFFFFF',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s var(--ease-fluid)'
                      }}
                    >
                      Filter Tracks
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 4: INGESTED TRACKS WITH ADVANCED MULTI-FILTER BAR */}
        {activeTab === 'tracks' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <Search size={14} color="#9B9B9B" style={{ position: 'absolute', left: '12px', top: '11px' }} />
              <input
                type="text"
                placeholder="Search songs or artists in library..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  background: '#1F1F1F',
                  border: '1px solid #272727',
                  borderRadius: '10px',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Filter Bar 1: Mood Filter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#9B9B9B' }}>
                Mood / Acoustic Valence
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[
                  { id: 'all', label: 'All Vibes' },
                  { id: 'euphoric', label: 'Euphoric' },
                  { id: 'melancholic', label: 'Melancholic' },
                  { id: 'chill', label: 'Chill' },
                  { id: 'high_energy', label: 'High Energy' },
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMood(m.id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: selectedMood === m.id ? '#a855f7' : '#272727',
                      background: selectedMood === m.id ? '#272727' : 'transparent',
                      color: selectedMood === m.id ? '#FFFFFF' : '#9B9B9B',
                      fontSize: '11px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s var(--ease-fluid)'
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Bar 2: Sort Strategy */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#9B9B9B' }}>
                Sort Strategy
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[
                  { id: 'highest_plays', label: 'Highest Plays' },
                  { id: 'past_plays', label: 'Past Plays' },
                  { id: 'most_loved', label: 'Most Loved' }
                ].map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSort(s.id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: selectedSort === s.id ? '#06b6d4' : '#272727',
                      background: selectedSort === s.id ? '#272727' : 'transparent',
                      color: selectedSort === s.id ? '#FFFFFF' : '#9B9B9B',
                      fontSize: '11px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s var(--ease-fluid)'
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Bar 3: Platform Source */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {[
                { id: 'all', label: 'All Sources' },
                { id: 'spotify', label: 'Spotify', icon: SpotifyIcon },
                { id: 'youtube', label: 'YouTube Music', icon: YouTubeIcon }
              ].map(src => {
                const Icon = src.icon;
                return (
                  <button
                    key={src.id}
                    onClick={() => setSelectedSource(src.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: selectedSource === src.id ? '#FFFFFF' : '#272727',
                      background: selectedSource === src.id ? '#272727' : 'transparent',
                      color: selectedSource === src.id ? '#FFFFFF' : '#9B9B9B',
                      fontSize: '11px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s var(--ease-fluid)'
                    }}
                  >
                    {Icon && <Icon size={12} />}
                    <span>{src.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tracks List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              {(library.all || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 16px', color: '#9B9B9B' }}>
                  No tracks matching active filters.
                </div>
              ) : (
                (library.all || []).map((tr, idx) => {
                  const isCurrent = (currentTrack?.track_id || currentTrack?.id) === tr.id;
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '10px 14px',
                        background: isCurrent ? '#272727' : '#1F1F1F',
                        border: '1px solid',
                        borderColor: isCurrent ? '#a855f7' : '#272727',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <button
                          onClick={() => playTrack({ ...tr, name: tr.title, track_id: tr.id })}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            background: '#272727',
                            border: '1px solid #313131',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: isCurrent && isPlaying ? '#10b981' : '#FFFFFF',
                            flexShrink: 0
                          }}
                          title="Play Track"
                        >
                          <Play size={12} fill={isCurrent && isPlaying ? '#10b981' : 'none'} />
                        </button>

                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontSize: '13px',
                            fontWeight: '600',
                            color: '#FFFFFF',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {tr.title}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: '#9B9B9B',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {(tr.artists || []).join(', ') || 'Various Artists'}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          color: '#9B9B9B',
                          fontVariantNumeric: 'tabular-nums'
                        }}>
                          {tr.play_count || 1}p
                        </span>
                        {tr.source === 'spotify' ? <SpotifyIcon size={14} /> : <YouTubeIcon size={14} />}
                        <a
                          href={getPlayUrl(tr)}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: '#9B9B9B',
                            display: 'flex',
                            alignItems: 'center',
                            textDecoration: 'none'
                          }}
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
