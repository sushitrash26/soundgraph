import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Music, Play, ExternalLink, Sparkles, Filter } from 'lucide-react';

const SpotifyIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#1DB954">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const YouTubeIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#FF0000">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

export default function LibraryDrawer() {
  const { library } = useStore();
  const [tab, setTab] = useState('all');

  const tracks = tab === 'spotify' 
    ? library.spotify 
    : tab === 'youtube' 
    ? library.youtube 
    : library.all;

  const getPlayUrl = (item) => {
    const artist = (item.artists && item.artists[0]) || '';
    const q = encodeURIComponent(`${item.title} ${artist}`);
    if (item.source === 'youtube') {
      return `https://music.youtube.com/search?q=${q}`;
    }
    return `https://open.spotify.com/search/${q}`;
  };

  return (
    <div style={{
      background: 'rgba(20, 20, 28, 0.65)',
      backdropFilter: 'blur(20px)',
      borderRadius: '24px',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', margin: 0 }}>
            Ingested Library
          </h2>
          <span style={{
            fontSize: '11.5px',
            padding: '3px 10px',
            borderRadius: '999px',
            background: 'rgba(255, 255, 255, 0.06)',
            color: 'var(--text-muted)',
            fontWeight: '600'
          }}>
            {library.total} tracks
          </span>
        </div>
        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
          Synchronized from your active Spotify and YouTube Music accounts.
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '6px',
        padding: '4px',
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '12px',
        marginBottom: '16px'
      }}>
        <button
          onClick={() => setTab('all')}
          style={{
            flex: 1,
            padding: '6px 10px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            background: tab === 'all' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
            color: tab === 'all' ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.2s ease'
          }}
        >
          All ({library.all?.length || 0})
        </button>

        <button
          onClick={() => setTab('spotify')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '6px 10px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            background: tab === 'spotify' ? 'rgba(29, 185, 84, 0.2)' : 'transparent',
            color: tab === 'spotify' ? '#4ade80' : 'var(--text-muted)',
            transition: 'all 0.2s ease'
          }}
        >
          <SpotifyIcon size={13} /> Spotify
        </button>

        <button
          onClick={() => setTab('youtube')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '6px 10px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            background: tab === 'youtube' ? 'rgba(255, 0, 0, 0.2)' : 'transparent',
            color: tab === 'youtube' ? '#f87171' : 'var(--text-muted)',
            transition: 'all 0.2s ease'
          }}
        >
          <YouTubeIcon size={13} /> YouTube
        </button>
      </div>

      {/* Track List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        paddingRight: '4px'
      }}>
        {(!tracks || tracks.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
            No tracks in this view. Connect an account to populate telemetry.
          </div>
        ) : (
          tracks.map((item, idx) => {
            const isSpot = item.source !== 'youtube';
            return (
              <div
                key={item.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '14px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.04)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: isSpot ? 'rgba(29, 185, 84, 0.15)' : 'rgba(255, 0, 0, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {isSpot ? <SpotifyIcon size={15} /> : <YouTubeIcon size={15} />}
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#fff',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {item.title}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {(item.artists && item.artists.join(', ')) || 'Artist'}
                    </div>
                  </div>
                </div>

                <a
                  href={getPlayUrl(item)}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: '#94a3b8',
                    padding: '6px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'color 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                  title="Open Track"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
