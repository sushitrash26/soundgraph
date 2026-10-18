import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowRight, 
  Check, 
  Copy, 
  ExternalLink, 
  Loader2, 
  Sparkles, 
  Lock, 
  Globe, 
  Link2, 
  CheckSquare, 
  Square,
  Music2,
  Tv
} from 'lucide-react';
import { useStore } from '../store/useStore';

export default function MigrationModal() {
  const {
    isMigrationModalOpen,
    activeMigrationSource,
    isResolvingTracks,
    migrationResolveData,
    isMigratingExecution,
    migrationResult,
    closeMigrationModal,
    executeMigration
  } = useStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState('private'); // 'private' | 'public' | 'unlisted'
  const [selectedTracks, setSelectedTracks] = useState([]);
  const [copied, setCopied] = useState(false);

  const playlist = activeMigrationSource?.playlist;
  const sourcePlatform = activeMigrationSource?.sourcePlatform || 'youtube';
  const targetPlatform = sourcePlatform === 'youtube' ? 'spotify' : 'youtube';

  useEffect(() => {
    if (playlist) {
      setTitle(playlist.title || 'Migrated Playlist');
      setDescription(playlist.description ? `Migrated via SoundGraph: ${playlist.description}` : 'Curated and migrated via SoundGraph cross-platform music engine');
      setPrivacy('private');
      setCopied(false);
    }
  }, [playlist]);

  useEffect(() => {
    if (migrationResolveData?.matched_tracks) {
      // Default to selecting all matched tracks
      setSelectedTracks(migrationResolveData.matched_tracks);
    }
  }, [migrationResolveData]);

  if (!isMigrationModalOpen || !playlist) return null;

  const handleToggleTrack = (track) => {
    const isSelected = selectedTracks.some((t) => (t.source_id || t.matched_title) === (track.source_id || track.matched_title));
    if (isSelected) {
      setSelectedTracks(selectedTracks.filter((t) => (t.source_id || t.matched_title) !== (track.source_id || track.matched_title)));
    } else {
      setSelectedTracks([...selectedTracks, track]);
    }
  };

  const handleSelectAll = () => {
    if (migrationResolveData?.matched_tracks) {
      if (selectedTracks.length === migrationResolveData.matched_tracks.length) {
        setSelectedTracks([]);
      } else {
        setSelectedTracks(migrationResolveData.matched_tracks);
      }
    }
  };

  const handleExecute = (method = 'direct') => {
    executeMigration({
      sourcePlatform,
      targetPlatform,
      title: title.trim() || playlist.title,
      description: description.trim(),
      privacy,
      tracks: selectedTracks,
      method
    });
  };

  const handleCopyClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(16px)'
    }}>
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '90vh',
        background: '#121217',
        border: '1px solid #272727',
        borderRadius: '24px',
        boxShadow: '0 32px 80px rgba(0, 0, 0, 0.9), 0 0 40px rgba(168, 85, 247, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 28px',
          borderBottom: '1px solid #222226',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: sourcePlatform === 'youtube' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
              border: sourcePlatform === 'youtube' ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(34, 197, 94, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: sourcePlatform === 'youtube' ? '#f87171' : '#4ade80'
            }}>
              {sourcePlatform === 'youtube' ? <Tv size={18} /> : <Music2 size={18} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px', fontWeight: '800', color: '#FFFFFF' }}>Migrate Playlist</span>
                <ArrowRight size={14} color="#9B9B9B" />
                <span style={{
                  fontSize: '12px',
                  fontWeight: '700',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: targetPlatform === 'spotify' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: targetPlatform === 'spotify' ? '#4ade80' : '#f87171',
                  border: targetPlatform === 'spotify' ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
                }}>
                  {targetPlatform === 'spotify' ? 'Spotify' : 'YouTube Music'}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#9B9B9B', margin: '2px 0 0' }}>
                From "{playlist.title}" ({playlist.track_count || playlist.tracks?.length || 0} tracks)
              </p>
            </div>
          </div>

          <button
            onClick={closeMigrationModal}
            style={{
              background: 'none',
              border: 'none',
              color: '#9B9B9B',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              transition: 'background 0.2s ease'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          
          {/* Success Screen if Migration Completed */}
          {migrationResult && (
            <div style={{
              padding: '24px',
              borderRadius: '18px',
              background: '#18181F',
              border: '1px solid #27272F',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px'
            }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.2)',
                border: '1px solid #22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 24px rgba(34, 197, 94, 0.4)'
              }}>
                <Check size={26} color="#22c55e" />
              </div>

              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#FFFFFF', margin: '0 0 6px' }}>
                  {migrationResult.method === 'clipboard' ? 'Playlist Ready for Instant Paste!' : 'Migration Complete!'}
                </h3>
                <p style={{ fontSize: '13px', color: '#CCCCCC', margin: 0, maxWidth: '440px' }}>
                  {migrationResult.message}
                </p>
              </div>

              {migrationResult.method === 'clipboard' ? (
                <div style={{
                  width: '100%',
                  background: '#0D0D11',
                  borderRadius: '14px',
                  padding: '16px',
                  textAlign: 'left',
                  border: '1px solid #222228',
                  fontSize: '12px'
                }}>
                  <div style={{ fontWeight: '700', color: '#FFFFFF', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} color="#a855f7" /> 3-Second Spotify Import Guide:
                  </div>
                  <ol style={{ margin: '0 0 14px 20px', padding: 0, color: '#9B9B9B', lineHeight: '20px' }}>
                    <li>Click the green button below to copy all {migrationResult.track_count} Spotify tracks.</li>
                    <li>Open Spotify (Desktop or Web) and create a <strong>New Playlist</strong>.</li>
                    <li>Click inside the new playlist and press <kbd style={{ background: '#272727', padding: '2px 6px', borderRadius: '4px', color: '#FFF' }}>Ctrl + V</kbd> (or <kbd style={{ background: '#272727', padding: '2px 6px', borderRadius: '4px', color: '#FFF' }}>Cmd + V</kbd>).</li>
                  </ol>

                  <button
                    onClick={() => handleCopyClipboard(migrationResult.clipboard_text)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '12px',
                      background: copied ? '#22c55e' : '#1db954',
                      border: 'none',
                      color: '#000000',
                      fontSize: '13px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 8px 24px rgba(29, 185, 84, 0.3)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    <span>{copied ? 'Copied to Clipboard! Ready to Paste' : `Copy ${migrationResult.track_count} Tracks to Clipboard`}</span>
                  </button>
                </div>
              ) : (
                migrationResult.playlist_url && (
                  <a
                    href={migrationResult.playlist_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 22px',
                      borderRadius: '9999px',
                      background: targetPlatform === 'spotify' ? '#1db954' : '#ef4444',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: '700',
                      textDecoration: 'none',
                      boxShadow: targetPlatform === 'spotify' ? '0 8px 24px rgba(29, 185, 84, 0.3)' : '0 8px 24px rgba(239, 68, 68, 0.3)'
                    }}
                  >
                    <span>Open in {targetPlatform === 'spotify' ? 'Spotify' : 'YouTube Music'}</span>
                    <ExternalLink size={14} />
                  </a>
                )
              )}

              <button
                onClick={closeMigrationModal}
                style={{
                  marginTop: '8px',
                  background: 'none',
                  border: 'none',
                  color: '#9B9B9B',
                  fontSize: '12.5px',
                  cursor: 'pointer'
                }}
              >
                Close Window
              </button>
            </div>
          )}

          {/* Form & Track Review when NOT finished */}
          {!migrationResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              
              {/* Section 1: Target Metadata Form */}
              <div style={{
                background: '#18181F',
                border: '1px solid #27272F',
                borderRadius: '18px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a855f7' }}>
                  Target Playlist Customization
                </div>

                {/* Playlist Name Input */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#FFFFFF', marginBottom: '6px' }}>
                    New Playlist Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter playlist title..."
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: '#121217',
                      border: '1px solid #31313A',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Description Input */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#FFFFFF', marginBottom: '6px' }}>
                    Description
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Custom playlist description..."
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: '#121217',
                      border: '1px solid #31313A',
                      color: '#FFFFFF',
                      fontSize: '12.5px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Privacy Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#FFFFFF', marginBottom: '6px' }}>
                    Privacy Status
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setPrivacy('private')}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        background: privacy === 'private' ? 'rgba(168, 85, 247, 0.2)' : '#121217',
                        border: privacy === 'private' ? '1px solid #a855f7' : '1px solid #27272F',
                        color: privacy === 'private' ? '#FFFFFF' : '#9B9B9B',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Lock size={13} color={privacy === 'private' ? '#c084fc' : '#9B9B9B'} />
                      <span>Private (Recommended)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPrivacy('public')}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        background: privacy === 'public' ? 'rgba(168, 85, 247, 0.2)' : '#121217',
                        border: privacy === 'public' ? '1px solid #a855f7' : '1px solid #27272F',
                        color: privacy === 'public' ? '#FFFFFF' : '#9B9B9B',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Globe size={13} color={privacy === 'public' ? '#c084fc' : '#9B9B9B'} />
                      <span>Public</span>
                    </button>

                    {targetPlatform === 'youtube' && (
                      <button
                        type="button"
                        onClick={() => setPrivacy('unlisted')}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '8px 12px',
                          borderRadius: '10px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          background: privacy === 'unlisted' ? 'rgba(168, 85, 247, 0.2)' : '#121217',
                          border: privacy === 'unlisted' ? '1px solid #a855f7' : '1px solid #27272F',
                          color: privacy === 'unlisted' ? '#FFFFFF' : '#9B9B9B',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Link2 size={13} color={privacy === 'unlisted' ? '#c084fc' : '#9B9B9B'} />
                        <span>Unlisted</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 2: Match Review & Track Inspector (Required by Question A3) */}
              <div style={{
                background: '#18181F',
                border: '1px solid #27272F',
                borderRadius: '18px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a855f7' }}>
                      Track Match Review & Confirmation
                    </div>
                    <div style={{ fontSize: '12px', color: '#9B9B9B', marginTop: '2px' }}>
                      {isResolvingTracks ? (
                        <span>Resolving cross-platform acoustic matches...</span>
                      ) : (
                        <span>
                          {selectedTracks.length} of {migrationResolveData?.total_count || 0} tracks selected ({migrationResolveData?.match_rate || 100}% Match Rate)
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSelectAll}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#c084fc',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    {migrationResolveData?.matched_tracks && selectedTracks.length === migrationResolveData.matched_tracks.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {/* Track List Scrollable Inspector */}
                <div style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  border: '1px solid #222228',
                  borderRadius: '12px',
                  background: '#121217',
                  padding: '6px'
                }}>
                  {isResolvingTracks ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: '#9B9B9B', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Matching track signatures across catalogs...</span>
                    </div>
                  ) : migrationResolveData?.matched_tracks && migrationResolveData.matched_tracks.length > 0 ? (
                    migrationResolveData.matched_tracks.map((t, idx) => {
                      const isSelected = selectedTracks.some((st) => (st.source_id || st.matched_title) === (t.source_id || t.matched_title));
                      return (
                        <div
                          key={idx}
                          onClick={() => handleToggleTrack(t)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                            borderBottom: '1px solid #1a1a20'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, paddingRight: '10px' }}>
                            <div style={{ color: isSelected ? '#a855f7' : '#666666', display: 'flex', alignItems: 'center' }}>
                              {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {t.source_title}
                              </div>
                              <div style={{ fontSize: '11px', color: '#9B9B9B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {t.source_artist} ➔ <span style={{ color: '#c084fc' }}>{t.matched_title}</span>
                              </div>
                            </div>
                          </div>

                          <span style={{
                            fontSize: '10px',
                            fontWeight: '700',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(34, 197, 94, 0.12)',
                            color: '#4ade80',
                            border: '1px solid rgba(34, 197, 94, 0.3)',
                            flexShrink: 0
                          }}>
                            {t.confidence}% Match
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#9B9B9B', fontSize: '12px' }}>
                      No tracks found to resolve.
                    </div>
                  )}
                </div>
              </div>

              {/* Execution Actions Area */}
              {targetPlatform === 'spotify' ? (
                // YouTube ➔ Spotify Dual Options (per Question A2)
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a855f7', marginBottom: '8px' }}>
                    Choose Migration Method:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button
                      onClick={() => handleExecute('direct')}
                      disabled={isMigratingExecution || selectedTracks.length === 0}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: '#1db954',
                        border: 'none',
                        color: '#000000',
                        fontSize: '12.5px',
                        fontWeight: '800',
                        cursor: isMigratingExecution || selectedTracks.length === 0 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 20px rgba(29, 185, 84, 0.3)',
                        opacity: isMigratingExecution || selectedTracks.length === 0 ? 0.6 : 1
                      }}
                    >
                      {isMigratingExecution ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
                      <span>Direct Web Sync</span>
                    </button>

                    <button
                      onClick={() => handleExecute('clipboard')}
                      disabled={isMigratingExecution || selectedTracks.length === 0}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: '#222228',
                        border: '1px solid #383844',
                        color: '#FFFFFF',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        cursor: isMigratingExecution || selectedTracks.length === 0 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        opacity: isMigratingExecution || selectedTracks.length === 0 ? 0.6 : 1
                      }}
                    >
                      <Copy size={15} color="#c084fc" />
                      <span>1-Click Clipboard (Ctrl+V)</span>
                    </button>
                  </div>
                </div>
              ) : (
                // Spotify ➔ YouTube 1-Click Migration
                <button
                  onClick={() => handleExecute('direct')}
                  disabled={isMigratingExecution || selectedTracks.length === 0}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: '800',
                    cursor: isMigratingExecution || selectedTracks.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 8px 24px rgba(239, 68, 68, 0.35)',
                    opacity: isMigratingExecution || selectedTracks.length === 0 ? 0.6 : 1
                  }}
                >
                  {isMigratingExecution ? (
                    <>
                      <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Creating Playlist on YouTube Music...</span>
                    </>
                  ) : (
                    <>
                      <Tv size={16} />
                      <span>Create & Migrate {selectedTracks.length} Tracks to YouTube</span>
                    </>
                  )}
                </button>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
