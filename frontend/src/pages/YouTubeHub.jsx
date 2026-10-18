import React, { useEffect } from 'react';
import { 
  Tv, 
  ArrowRight, 
  Music2, 
  Sparkles, 
  Radio, 
  Lock, 
  Globe, 
  Layers, 
  ExternalLink,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { useStore } from '../store/useStore';

export default function YouTubeHub() {
  const {
    youtubeProfile,
    youtubePlaylists,
    isLoadingPlatformData,
    fetchPlatformData,
    openMigrationModal,
    authStatus,
    user
  } = useStore();

  useEffect(() => {
    fetchPlatformData('youtube');
  }, []);

  const isConnected = authStatus?.google_connected;

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '32px 24px' }}>
      
      {/* Top Hero & Taste Profile Card */}
      <div style={{
        padding: '32px',
        borderRadius: '24px',
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(24, 24, 27, 0.9) 100%)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5), 0 0 30px rgba(239, 68, 68, 0.08)',
        marginBottom: '32px'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
          
          {/* Identity & Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 30px rgba(239, 68, 68, 0.4)',
              border: '2px solid rgba(255, 255, 255, 0.2)'
            }}>
              <Tv size={36} color="#FFFFFF" />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#FFFFFF', margin: 0, letterSpacing: '-0.02em' }}>
                  YouTube Music Hub
                </h1>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '3px 8px',
                  borderRadius: '999px',
                  background: isConnected ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                  color: isConnected ? '#f87171' : '#9B9B9B',
                  border: isConnected ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid #333'
                }}>
                  {isConnected ? '● Connected' : '○ Offline Mode'}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: '#9B9B9B', margin: '4px 0 0' }}>
                Manage your YouTube Music playlists, view your 169+ liked songs, and migrate directly to Spotify.
              </p>
            </div>
          </div>

          {/* Quick Refresh */}
          <button
            onClick={() => fetchPlatformData('youtube')}
            disabled={isLoadingPlatformData}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '12px',
              background: '#1F1F24',
              border: '1px solid #2E2E38',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={13} className={isLoadingPlatformData ? 'spin' : ''} style={{ animation: isLoadingPlatformData ? 'spin 1s linear infinite' : 'none' }} />
            <span>Sync Playlists</span>
          </button>
        </div>

        {/* Platform Taste Metrics Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginTop: '28px',
          paddingTop: '24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          {/* Card 1: Total Liked Tracks */}
          <div style={{ background: '#121217', padding: '16px', borderRadius: '16px', border: '1px solid #222228' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#9B9B9B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Liked YouTube Tracks
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#FFFFFF', marginTop: '6px' }}>
              {youtubeProfile?.total_tracks || 0}
            </div>
            <div style={{ fontSize: '11px', color: '#f87171', marginTop: '4px' }}>
              Indexed in Cross-Platform Graph
            </div>
          </div>

          {/* Card 2: Top Artists */}
          <div style={{ background: '#121217', padding: '16px', borderRadius: '16px', border: '1px solid #222228' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#9B9B9B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Top YouTube Artists
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
              {youtubeProfile?.top_artists && youtubeProfile.top_artists.length > 0 ? (
                youtubeProfile.top_artists.slice(0, 3).map((a, i) => (
                  <span key={i} style={{ fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                    {a}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '11.5px', color: '#666', fontStyle: 'italic', paddingTop: '2px' }}>
                  No artists indexed yet
                </span>
              )}
            </div>
          </div>

          {/* Card 3: Top Genres */}
          <div style={{ background: '#121217', padding: '16px', borderRadius: '16px', border: '1px solid #222228' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#9B9B9B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Top YouTube Genres
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
              {youtubeProfile?.top_genres && youtubeProfile.top_genres.length > 0 ? (
                youtubeProfile.top_genres.slice(0, 3).map((g, i) => (
                  <span key={i} style={{ fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '6px', background: '#1E1E26', color: '#CCCCCC', border: '1px solid #2D2D38' }}>
                    {g}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '11.5px', color: '#666', fontStyle: 'italic', paddingTop: '2px' }}>
                  No genres indexed yet
                </span>
              )}
            </div>
          </div>

          {/* Card 4: Acoustic Profile */}
          <div style={{ background: '#121217', padding: '16px', borderRadius: '16px', border: '1px solid #222228' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#9B9B9B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Acoustic Profile
            </div>
            {youtubeProfile?.total_tracks > 0 ? (
              <>
                <div style={{ fontSize: '12px', color: '#CCCCCC', marginTop: '8px', lineHeight: '18px' }}>
                  Energy: <strong style={{ color: '#FFFFFF' }}>{Math.round((youtubeProfile?.radar?.energy || 0) * 100)}%</strong> · Dance: <strong style={{ color: '#FFFFFF' }}>{Math.round((youtubeProfile?.radar?.danceability || 0) * 100)}%</strong>
                </div>
                <div style={{ fontSize: '11px', color: '#9B9B9B', marginTop: '2px' }}>
                  Valence: <strong style={{ color: '#FFFFFF' }}>{Math.round((youtubeProfile?.radar?.valence || 0) * 100)}%</strong>
                </div>
              </>
            ) : (
              <div style={{ fontSize: '11.5px', color: '#666', fontStyle: 'italic', marginTop: '8px' }}>
                Connect account to analyze acoustics
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Playlists Ledger & 1-Click Migration Section */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#FFFFFF', margin: 0 }}>
              YouTube Playlists & Collections
            </h2>
            <p style={{ fontSize: '12.5px', color: '#9B9B9B', margin: '4px 0 0' }}>
              Select any playlist to review tracks, customize title and privacy, and migrate directly to Spotify.
            </p>
          </div>
        </div>

        {/* Playlists Grid */}
        {isLoadingPlatformData ? (
          <div style={{ padding: '64px', textAlign: 'center', color: '#9B9B9B', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Loader2 size={18} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
            <span>Fetching YouTube playlists from cross-platform graph...</span>
          </div>
        ) : youtubePlaylists && youtubePlaylists.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {youtubePlaylists.map((pl) => (
              <div
                key={pl.id}
                style={{
                  background: '#18181F',
                  border: '1px solid #27272F',
                  borderRadius: '20px',
                  padding: '18px',
                  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'transform 0.2s ease, border-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = '#27272F';
                }}
              >
                <div>
                  {/* Card Header with Artwork & Privacy */}
                  <div style={{ display: 'flex', gap: '14px', marginBottom: '14px' }}>
                    <img
                      src={pl.cover_url || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300"}
                      alt={pl.title}
                      style={{
                        width: '74px',
                        height: '74px',
                        borderRadius: '12px',
                        objectFit: 'cover',
                        background: '#27272F',
                        flexShrink: 0
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '700',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: pl.privacy === 'public' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                          color: pl.privacy === 'public' ? '#60a5fa' : '#9B9B9B'
                        }}>
                          {pl.privacy === 'public' ? 'Public' : 'Private'}
                        </span>
                        <span style={{ fontSize: '11px', color: '#9B9B9B' }}>
                          {pl.track_count || pl.tracks?.length || 0} tracks
                        </span>
                      </div>

                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#FFFFFF', margin: '0 0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {pl.title}
                      </h3>
                      <p style={{ fontSize: '12px', color: '#9B9B9B', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {pl.description || "YouTube Music playlist collection"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 1-Click Migration Button to Spotify */}
                <button
                  onClick={() => openMigrationModal(pl, 'youtube')}
                  style={{
                    width: '100%',
                    padding: '11px 16px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(21, 128, 61, 0.15) 100%)',
                    border: '1px solid rgba(34, 197, 94, 0.4)',
                    color: '#4ade80',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #1db954 0%, #15803d 100%)';
                    e.currentTarget.style.color = '#FFFFFF';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(29, 185, 84, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(21, 128, 61, 0.15) 100%)';
                    e.currentTarget.style.color = '#4ade80';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <Music2 size={15} />
                  <span>Migrate to Spotify</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            padding: '48px',
            textAlign: 'center',
            background: '#18181F',
            borderRadius: '20px',
            border: '1px solid #27272F',
            color: '#9B9B9B'
          }}>
            <Tv size={32} color="#ef4444" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#FFFFFF', margin: '0 0 6px' }}>No YouTube Playlists Found</h3>
            <p style={{ fontSize: '13px', margin: 0, maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
              Connect your YouTube account in the top navigation bar to automatically index your saved playlists and collections.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
