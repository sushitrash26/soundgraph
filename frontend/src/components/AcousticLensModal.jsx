import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { 
  Mic, 
  X, 
  Sparkles, 
  Radio, 
  ExternalLink, 
  Play, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Music, 
  Compass,
  Volume2
} from 'lucide-react';
import axios from 'axios';

const YouTubeIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#FF0000">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

export default function AcousticLensModal({ isOpen, onClose }) {
  const { user, playTrack, recommendations, appendFrontierCandidates } = useStore();
  const { 
    isRecording, 
    recordingDuration, 
    audioBlob, 
    error: micError, 
    startRecording, 
    stopRecording, 
    getAudioFrequencyData, 
    getSnapshotBlob,
    reset 
  } = useAudioRecorder();

  const [state, setState] = useState('idle'); // idle | recording | analyzing | result | error
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [hint, setHint] = useState('');

  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const probeActiveRef = useRef(false);
  const lastProbeTimeRef = useRef(0);

  // Frequency Waveform Visualizer on Canvas
  useEffect(() => {
    if (!isRecording || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const render = () => {
      const data = getAudioFrequencyData();
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = 55;

      // Draw glowing central orb
      const gradient = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, 80);
      gradient.addColorStop(0, 'rgba(192, 132, 252, 0.45)');
      gradient.addColorStop(0.5, 'rgba(6, 182, 212, 0.25)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 80, 0, Math.PI * 2);
      ctx.fill();

      // Draw frequency circular bars
      const numBars = data.length || 32;
      const angleStep = (Math.PI * 2) / numBars;

      for (let i = 0; i < numBars; i++) {
        const val = data[i] || 0;
        const barHeight = (val / 255.0) * 45;
        const angle = i * angleStep;

        const x1 = centerX + Math.cos(angle) * baseRadius;
        const y1 = centerY + Math.sin(angle) * baseRadius;
        const x2 = centerX + Math.cos(angle) * (baseRadius + barHeight + 4);
        const y2 = centerY + Math.sin(angle) * (baseRadius + barHeight + 4);

        ctx.strokeStyle = i % 2 === 0 ? '#c084fc' : '#38bdf8';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isRecording, getAudioFrequencyData]);

  // Sync state transitions with audio recorder
  useEffect(() => {
    if (isRecording) {
      setState('recording');
      probeActiveRef.current = false;
      lastProbeTimeRef.current = 0;
    }
  }, [isRecording]);

  // Real-time rolling background probe: checks at ~6s, 12s, 18s, 24s
  useEffect(() => {
    if (!isRecording) return;

    const currentSec = Math.floor(recordingDuration);
    const probeCheckpoints = [6, 12, 18, 24];

    if (
      probeCheckpoints.includes(currentSec) &&
      (currentSec - lastProbeTimeRef.current) >= 5 &&
      !probeActiveRef.current
    ) {
      lastProbeTimeRef.current = currentSec;
      const snapshot = getSnapshotBlob();
      if (snapshot && snapshot.size > 20000) {
        probeActiveRef.current = true;
        const formData = new FormData();
        const extension = snapshot.type.includes('webm') ? 'webm' : 'wav';
        formData.append('file', snapshot, `probe.${extension}`);
        formData.append('user_id', user?.id || 'astitva_demo_user');
        if (hint.trim()) formData.append('hint', hint.trim());

        axios.post('http://localhost:8001/vibe/identify-audio', formData)
          .then((res) => {
            if (res.data && res.data.status === 'success' && res.data.confidence >= 0.88) {
              // Early lock-on achieved!
              stopRecording();
              setResult({
                ...res.data,
                early_detected: true,
                detected_at: recordingDuration.toFixed(1)
              });
              setState('result');
            } else {
              probeActiveRef.current = false;
            }
          })
          .catch(() => {
            probeActiveRef.current = false;
          });
      }
    }
  }, [isRecording, recordingDuration, getSnapshotBlob, hint, user, stopRecording]);

  // When audioBlob is ready, dispatch to backend
  useEffect(() => {
    if (!audioBlob) return;

    const identifyAudio = async () => {
      setState('analyzing');
      try {
        const formData = new FormData();
        const extension = audioBlob.type.includes('webm') ? 'webm' : 'wav';
        formData.append('file', audioBlob, `snippet.${extension}`);
        formData.append('user_id', user?.id || 'astitva_demo_user');
        if (hint.trim()) {
          formData.append('hint', hint.trim());
        }

        const res = await axios.post('http://localhost:8001/vibe/identify-audio', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.data && res.data.status === 'success') {
          setResult(res.data);
          setState('result');
        } else if (res.data && res.data.status === 'unrecognized') {
          setErrorMessage(res.data.message || 'We could not pick up singing or lyrics clearly. Try singing a bit louder or closer to the mic!');
          setState('error');
        } else {
          setErrorMessage(res.data?.message || 'Could not resolve matching sonic identity.');
          setState('error');
        }
      } catch (err) {
        console.error('Audio identification error:', err);
        setErrorMessage(err.response?.data?.detail || 'Sonic analysis service error. Please try again.');
        setState('error');
      }
    };

    identifyAudio();
  }, [audioBlob, hint, user]);

  if (!isOpen) return null;

  const handleStart = () => {
    reset();
    setResult(null);
    setErrorMessage('');
    startRecording();
  };

  const handlePlayNow = () => {
    if (result && result.card) {
      playTrack(result.card);
      onClose();
    }
  };

  const handleAddToDeck = () => {
    if (result && result.card) {
      appendFrontierCandidates([result.card]);
      onClose();
    }
  };

  const handleSelectCandidate = (cand) => {
    const card = {
      track_id: `youtube:video:${cand.video_id || 'nyuo9-OjNNg'}`,
      id: `youtube:video:${cand.video_id || 'nyuo9-OjNNg'}`,
      track_name: cand.title,
      name: cand.title,
      artists: [cand.artist],
      genres: result?.genres || ['Acoustic'],
      source: 'youtube',
      cover_url: cand.thumbnail || result?.thumbnail,
      uri: cand.youtube_url || `https://www.youtube.com/watch?v=${cand.video_id}`,
      preview_url: cand.youtube_url || `https://www.youtube.com/watch?v=${cand.video_id}`,
      score: 0.92,
      popularity: 85,
      bandit_arm: 3,
      arm_name: 'frontier_wildcard',
      reason: `✨ Melodic Match: ${cand.reason}`,
      transition_flow: 'Alternative Melodic Resolution'
    };
    playTrack(card);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(5, 7, 12, 0.82)',
      backdropFilter: 'blur(28px)',
      padding: '20px'
    }}>
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '520px',
        background: 'linear-gradient(145deg, rgba(23, 25, 38, 0.95), rgba(13, 14, 22, 0.98))',
        border: '1px solid rgba(168, 85, 247, 0.3)',
        borderRadius: '28px',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8), 0 0 40px rgba(168, 85, 247, 0.2)',
        padding: '32px',
        overflow: 'hidden'
      }}>
        {/* Close Button */}
        <button
          onClick={() => {
            stopRecording();
            onClose();
          }}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 14px',
            borderRadius: '999px',
            background: 'rgba(168, 85, 247, 0.15)',
            border: '1px solid rgba(168, 85, 247, 0.35)',
            color: '#c084fc',
            fontSize: '11.5px',
            fontWeight: '700',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '10px'
          }}>
            <Sparkles size={13} /> Acoustic Lens
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#fff', margin: 0, fontFamily: 'var(--font-heading)' }}>
            Super-Shazam & YouTube Resolver
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>
            Listen to any song, hum, chords, or vocals — embedded into vector space & resolved to YouTube.
          </p>
        </div>

        {/* Content Body Based on State */}
        {state === 'idle' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ position: 'relative', width: '130px', height: '130px', margin: '0 auto 24px' }}>
              <button
                onClick={handleStart}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 35px rgba(168, 85, 247, 0.5)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                title="Click to Listen"
              >
                <Mic size={44} color="#fff" />
              </button>
            </div>

            <div style={{ color: '#e2e8f0', fontSize: '15px', fontWeight: '600', marginBottom: '8px' }}>
              Tap to Listen
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '12.5px', maxWidth: '320px', margin: '0 auto 20px' }}>
              Works with club music, live DJ sets, acoustic buskers, humming, and songs released 2 minutes ago.
            </div>

            <input
              type="text"
              placeholder="Optional hint: e.g. '90s French house' or 'heard in Boiler Room'"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff',
                fontSize: '12.5px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        )}

        {state === 'recording' && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ position: 'relative', width: '220px', height: '220px', margin: '0 auto' }}>
              <canvas 
                ref={canvasRef} 
                width={220} 
                height={220} 
                style={{ width: '100%', height: '100%' }}
              />
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none'
              }}>
                <Radio size={28} color="#c084fc" className="pulse" />
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#fff', marginTop: '6px' }}>
                  {recordingDuration.toFixed(1)}s / 30.0s
                </div>
              </div>
            </div>

            <div style={{ color: '#fff', fontSize: '15px', fontWeight: '700', marginTop: '16px' }}>
              Listening in real time...
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '12.5px', marginTop: '4px' }}>
              Auto-identifies when recognized (up to 30s), or tap Stop anytime
            </div>

            <button
              onClick={stopRecording}
              style={{
                marginTop: '20px',
                padding: '8px 24px',
                borderRadius: '999px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                fontSize: '12.5px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Stop & Identify Now
            </button>
          </div>
        )}

        {state === 'analyzing' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              border: '3px solid rgba(168, 85, 247, 0.2)',
              borderTopColor: '#c084fc',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }} />
            <div style={{ color: '#fff', fontSize: '16px', fontWeight: '700' }}>
              Resolving Sonic Identity...
            </div>
            <div style={{ color: '#38bdf8', fontSize: '13px', marginTop: '8px' }}>
              Listening & transcribing lyrics with Gemini Audio Intelligence and querying live YouTube music index
            </div>
          </div>
        )}

        {state === 'result' && result && (
          <div style={{ padding: '4px 0' }}>
            {/* Track Info Card */}
            <div style={{
              display: 'flex',
              gap: '16px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              padding: '16px',
              marginBottom: '16px',
              alignItems: 'center'
            }}>
              <img 
                src={result.thumbnail} 
                alt={result.title}
                style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '14px',
                  objectFit: 'cover',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(34, 197, 94, 0.15)',
                    color: '#4ade80',
                    fontSize: '10.5px',
                    fontWeight: '700'
                  }}>
                    <CheckCircle2 size={11} /> {Math.round(result.confidence * 100)}% Verified Match
                  </div>
                  {result.early_detected && (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: 'rgba(168, 85, 247, 0.15)',
                      border: '1px solid rgba(168, 85, 247, 0.35)',
                      color: '#c084fc',
                      fontSize: '10px',
                      fontWeight: '700'
                    }}>
                      ⚡ Locked in {result.detected_at}s
                    </div>
                  )}
                </div>
                <h3 style={{
                  fontSize: '17px',
                  fontWeight: '700',
                  color: '#fff',
                  margin: '0 0 2px 0',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {result.title}
                </h3>
                <p style={{
                  fontSize: '13px',
                  color: 'var(--text-muted)',
                  margin: '0 0 8px 0',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {result.artist}
                </p>

                {/* Direct YouTube Link Badge */}
                <a
                  href={result.youtube_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#f87171',
                    fontSize: '11.5px',
                    fontWeight: '600',
                    textDecoration: 'none'
                  }}
                  title="Open video on YouTube"
                >
                  <YouTubeIcon size={14} />
                  <span>Watch on YouTube</span>
                  <ExternalLink size={11} />
                </a>
              </div>
            </div>

            {/* Detected Lyrics / Verbals if any */}
            {result.detected_lyrics && (
              <div style={{
                background: 'rgba(168, 85, 247, 0.08)',
                border: '1px solid rgba(168, 85, 247, 0.25)',
                borderRadius: '14px',
                padding: '10px 14px',
                marginBottom: '14px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                  🗣 Transcribed Vocal Lyrics
                </div>
                <div style={{ fontSize: '12.5px', color: '#e2e8f0', fontStyle: 'italic' }}>
                  "{result.detected_lyrics}"
                </div>
              </div>
            )}

            {/* Acoustic Character Callout */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '14px',
              padding: '12px 14px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  🌊 Acoustic Character
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: '700',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: result.timbre_type === 'vocal_hum' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                    border: `1px solid ${result.timbre_type === 'vocal_hum' ? 'rgba(168, 85, 247, 0.35)' : 'rgba(56, 189, 248, 0.35)'}`,
                    color: result.timbre_type === 'vocal_hum' ? '#c084fc' : '#38bdf8'
                  }}>
                    {result.timbre_type === 'vocal_hum' ? '🎤 Vocal / Hum' : '📻 Master Audio'}
                  </span>
                  {result.dominant_keys && result.dominant_keys.length > 0 && (
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#cbd5e1'
                    }}>
                      🎹 {result.dominant_keys.join(', ')}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                {result.vibe_description}
              </div>
            </div>

            {/* Alternative Melodic Matches (if humming or multiple candidates) */}
            {result.candidates && result.candidates.length > 0 && (
              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  🎵 Alternative Melodic Matches
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {result.candidates.map((cand, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectCandidate(cand)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.07)',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'background 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.12)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        {cand.thumbnail ? (
                          <img src={cand.thumbnail} alt={cand.title} style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Music size={14} color="#94a3b8" />
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {cand.title}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {cand.artist} • <span style={{ color: '#c084fc' }}>{cand.reason}</span>
                          </div>
                        </div>
                      </div>
                      <button style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '28px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}>
                        <Play size={12} fill="#fff" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handlePlayNow}
                className="btn-primary"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px',
                  fontSize: '13px',
                  fontWeight: '700'
                }}
              >
                <Play size={16} fill="#fff" />
                <span>Play in SoundGraph</span>
              </button>

              <button
                onClick={handleAddToDeck}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                <span>+ Add to 3D Deck</span>
              </button>

              <button
                onClick={handleStart}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#94a3b8',
                  cursor: 'pointer'
                }}
                title="Identify another track"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>
        )}

        {state === 'error' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <AlertCircle size={40} color="#f87171" style={{ marginBottom: '12px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#fff', marginBottom: '6px' }}>
              Recognition Inconclusive
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '18px', lineHeight: '1.4' }}>
              {errorMessage || micError || 'Could not pick up distinct vocal lyrics or melody.'}
            </p>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '14px',
              padding: '12px 16px',
              textAlign: 'left',
              fontSize: '12px',
              color: 'var(--text-dim)',
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div>🎤 <strong>Sing a phrase or hook</strong> clearly into your microphone</div>
              <div>🎵 <strong>Hum the melody</strong> with steady rhythm</div>
              <div>💬 <strong>Add an optional hint</strong> below (e.g. artist or words you remember)</div>
            </div>

            <input
              type="text"
              placeholder="Optional hint: e.g. 'Arctic Monkeys' or 'Bollywood romantic'"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff',
                fontSize: '12.5px',
                outline: 'none',
                boxSizing: 'border-box',
                marginBottom: '16px'
              }}
            />

            <button
              onClick={handleStart}
              className="btn-primary"
              style={{ padding: '10px 28px', fontSize: '13px' }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
