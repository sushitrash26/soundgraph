import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  VolumeX, 
  ThumbsUp, 
  ThumbsDown, 
  ExternalLink, 
  Sparkles, 
  Disc3, 
  Music,
  Radio,
  Sliders
} from 'lucide-react';

const SpotifyIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#1DB954">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const YouTubeIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#FF0000">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

export default function AudioPlayerBar() {
  const { 
    currentTrack, 
    isPlaying, 
    setIsPlaying, 
    playNextTrack, 
    playPrevTrack, 
    sendFeedback,
    sendDwellTelemetry 
  } = useStore();

  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(180);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isAutoQueue, setIsAutoQueue] = useState(true);

  const audioRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const ytContainerRef = useRef(null);
  const dwellTimerRef = useRef(null);
  const trackStartTimeRef = useRef(Date.now());

  // Load YouTube IFrame API script
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Sync track start and dwell telemetry
  useEffect(() => {
    trackStartTimeRef.current = Date.now();
    setProgress(0);

    if (currentTrack) {
      const rawId = currentTrack.track_id || currentTrack.id || '';
      const isYt = currentTrack.source === 'youtube' || rawId.includes('youtube:video:');

      if (isYt) {
        const vidId = rawId.replace('youtube:video:', '');
        initOrPlayYouTube(vidId);
      } else if (currentTrack.preview_url) {
        if (audioRef.current) {
          audioRef.current.src = currentTrack.preview_url;
          audioRef.current.volume = isMuted ? 0 : volume;
          audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        }
      }
    }

    // Continuous dwell-time telemetry interval (every 8 seconds of active playback)
    clearInterval(dwellTimerRef.current);
    dwellTimerRef.current = setInterval(() => {
      if (isPlaying && currentTrack) {
        const dwell = Date.now() - trackStartTimeRef.current;
        sendDwellTelemetry(
          currentTrack.track_id || currentTrack.id, 
          currentTrack.bandit_arm || 0, 
          dwell, 
          null
        );
      }
    }, 8000);

    return () => clearInterval(dwellTimerRef.current);
  }, [currentTrack]);

  // Handle Play/Pause
  useEffect(() => {
    if (!currentTrack) return;
    const rawId = currentTrack.track_id || currentTrack.id || '';
    const isYt = currentTrack.source === 'youtube' || rawId.includes('youtube:video:');

    if (isYt && ytPlayerRef.current && ytPlayerRef.current.playVideo) {
      if (isPlaying) {
        ytPlayerRef.current.playVideo();
      } else {
        ytPlayerRef.current.pauseVideo();
      }
    } else if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  const initOrPlayYouTube = (videoId) => {
    try {
      if (window.YT && window.YT.Player) {
        if (!ytPlayerRef.current) {
          const el = document.getElementById('sg-hidden-yt-player');
          if (!el) return;
          ytPlayerRef.current = new window.YT.Player('sg-hidden-yt-player', {
            height: '1',
            width: '1',
            videoId: videoId,
            playerVars: {
              autoplay: 1,
              controls: 0,
              disablekb: 1,
              modestbranding: 1,
              origin: window.location.origin
            },
            events: {
              onReady: (e) => {
                try {
                  e.target.setVolume(volume * 100);
                  e.target.playVideo();
                  setIsPlaying(true);
                } catch (err) {}
              },
              onStateChange: (e) => {
                if (e.data === window.YT.PlayerState.PLAYING) {
                  setIsPlaying(true);
                  if (ytPlayerRef.current && ytPlayerRef.current.getDuration) {
                    setDuration(ytPlayerRef.current.getDuration() || 180);
                  }
                } else if (e.data === window.YT.PlayerState.PAUSED) {
                  setIsPlaying(false);
                } else if (e.data === window.YT.PlayerState.ENDED) {
                  setIsPlaying(false);
                  if (isAutoQueue) playNextTrack();
                }
              }
            }
          });
        } else if (ytPlayerRef.current.loadVideoById) {
          ytPlayerRef.current.loadVideoById(videoId);
          ytPlayerRef.current.playVideo();
          setIsPlaying(true);
        }
      }
    } catch (e) {
      console.warn('YouTube IFrame player initialization warning:', e);
    }
  };

  // Progress ticker for smooth scrubber movement
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isPlaying || !currentTrack) return;
      const rawId = currentTrack.track_id || currentTrack.id || '';
      const isYt = currentTrack.source === 'youtube' || rawId.includes('youtube:video:');

      if (isYt && ytPlayerRef.current && ytPlayerRef.current.getCurrentTime) {
        const cur = ytPlayerRef.current.getCurrentTime() || 0;
        const dur = ytPlayerRef.current.getDuration() || 180;
        setProgress(cur);
        setDuration(dur);
      } else if (audioRef.current) {
        setProgress(audioRef.current.currentTime || 0);
        setDuration(audioRef.current.duration || 30);
      }
    }, 500);

    return () => clearInterval(timer);
  }, [isPlaying, currentTrack]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setProgress(newTime);
    const rawId = currentTrack?.track_id || currentTrack?.id || '';
    const isYt = currentTrack?.source === 'youtube' || rawId.includes('youtube:video:');

    if (isYt && ytPlayerRef.current && ytPlayerRef.current.seekTo) {
      ytPlayerRef.current.seekTo(newTime, true);
    } else if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleVolume = (e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    setIsMuted(v === 0);
    if (audioRef.current) audioRef.current.volume = v;
    if (ytPlayerRef.current && ytPlayerRef.current.setVolume) {
      ytPlayerRef.current.setVolume(v * 100);
    }
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!currentTrack) {
    return (
      <div id="sg-hidden-yt-player" ref={ytContainerRef} style={{ display: 'none' }} />
    );
  }

  const isSpotify = currentTrack.source !== 'youtube';
  const rawId = currentTrack.track_id || currentTrack.id || '';
  let thumb = currentTrack.cover_url;
  if (!thumb && rawId.includes('youtube:video:')) {
    thumb = `https://img.youtube.com/vi/${rawId.replace('youtube:video:', '')}/hqdefault.jpg`;
  }
  if (!thumb) {
    thumb = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=120&auto=format&fit=crop&q=80';
  }

  return (
    <>
      {/* Hidden YouTube IFrame */}
      <div id="sg-hidden-yt-player" ref={ytContainerRef} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />

      {/* Hidden HTML5 Audio Element for Spotify Previews */}
      <audio 
        ref={audioRef} 
        onEnded={() => {
          setIsPlaying(false);
          if (isAutoQueue) playNextTrack();
        }}
      />

      {/* Docked Global Bottom Playback Bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '84px',
        background: 'rgba(12, 13, 20, 0.94)',
        backdropFilter: 'blur(32px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 -16px 40px rgba(0, 0, 0, 0.7), 0 0 24px rgba(168, 85, 247, 0.15)',
        zIndex: 999,
        padding: '0 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'transform 0.3s ease'
      }}>
        {/* Left Section: Track Info & Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '30%', minWidth: '220px' }}>
          <div style={{ position: 'relative', width: 48, height: 48, borderRadius: '12px', overflow: 'hidden', flexShrink: 0, boxShadow: '0 4px 14px rgba(0,0,0,0.5)' }}>
            <img 
              src={thumb} 
              alt={currentTrack.track_name || currentTrack.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=120'; }}
            />
            {isPlaying && (
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px'
              }}>
                <span style={{ width: '3px', height: '14px', background: '#c084fc', borderRadius: '1px', animation: 'wave 0.8s ease-in-out infinite' }} />
                <span style={{ width: '3px', height: '22px', background: '#38bdf8', borderRadius: '1px', animation: 'wave 0.6s ease-in-out infinite 0.2s' }} />
                <span style={{ width: '3px', height: '10px', background: '#c084fc', borderRadius: '1px', animation: 'wave 0.9s ease-in-out infinite 0.4s' }} />
              </div>
            )}
          </div>

          <div style={{ overflow: 'hidden' }}>
            <div style={{
              fontSize: '13.5px',
              fontWeight: '700',
              color: '#fff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginBottom: '3px'
            }}>
              {currentTrack.track_name || currentTrack.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {(currentTrack.artists || []).join(', ') || 'Artist'}
              </span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: '999px',
                background: isSpotify ? 'rgba(29, 185, 84, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: isSpotify ? '#4ade80' : '#f87171',
                fontWeight: '700'
              }}>
                {isSpotify ? <SpotifyIcon size={10} /> : <YouTubeIcon size={10} />}
                {isSpotify ? 'Spotify' : 'YouTube'}
              </span>
            </div>
          </div>
        </div>

        {/* Center Section: Controls & Audio Scrubber */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40%', maxWidth: '560px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '6px' }}>
            <button
              onClick={playPrevTrack}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              title="Previous"
            >
              <SkipBack size={18} />
            </button>

            <button
              onClick={togglePlay}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)',
                border: 'none',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(168, 85, 247, 0.4)',
                transition: 'transform 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              {isPlaying ? <Pause size={17} fill="#fff" /> : <Play size={17} fill="#fff" style={{ marginLeft: 2 }} />}
            </button>

            <button
              onClick={playNextTrack}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              title="Next Track"
            >
              <SkipForward size={18} />
            </button>

            <button
              onClick={() => setIsAutoQueue(!isAutoQueue)}
              style={{
                background: isAutoQueue ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                border: isAutoQueue ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid transparent',
                borderRadius: '8px',
                padding: '3px 8px',
                color: isAutoQueue ? '#c084fc' : '#64748b',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Continuous Auto-Mix Queue"
            >
              <Radio size={12} /> Auto-Queue
            </button>
          </div>

          {/* Scrubber Bar */}
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', width: '32px', textAlign: 'right' }}>
              {formatTime(progress)}
            </span>
            <input 
              type="range" 
              min="0" 
              max={duration || 180} 
              step="1"
              value={progress}
              onChange={handleSeek}
              style={{
                flex: 1,
                height: '4px',
                accentColor: '#c084fc',
                cursor: 'pointer'
              }}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', width: '32px' }}>
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Right Section: Volume & Instant Feedback */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px', width: '30%', minWidth: '220px' }}>
          {/* Reaction Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => sendFeedback(currentTrack.track_id || currentTrack.id, 1.0)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4ade80',
                cursor: 'pointer'
              }}
              title="Save affinity to graph (+1.0 reward)"
            >
              <ThumbsUp size={14} />
            </button>

            <button
              onClick={() => sendFeedback(currentTrack.track_id || currentTrack.id, -1.0)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f87171',
                cursor: 'pointer'
              }}
              title="Prune branch (-1.0 penalty)"
            >
              <ThumbsDown size={14} />
            </button>
          </div>

          {/* Volume Control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => {
                const nextMute = !isMuted;
                setIsMuted(nextMute);
                if (audioRef.current) audioRef.current.volume = nextMute ? 0 : volume;
                if (ytPlayerRef.current?.setVolume) ytPlayerRef.current.setVolume(nextMute ? 0 : volume * 100);
              }}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input 
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolume}
              style={{ width: '70px', height: '4px', accentColor: '#c084fc', cursor: 'pointer' }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
