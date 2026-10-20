import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Pressable, 
  ActivityIndicator, 
  Image, 
  ScrollView, 
  Linking 
} from 'react-native';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { 
  useAudioRecorder, 
  RecordingPresets, 
  requestRecordingPermissionsAsync, 
  setAudioModeAsync 
} from 'expo-audio';
import { 
  Radio, 
  Mic, 
  Sparkles, 
  Volume2, 
  Activity, 
  Check, 
  Square, 
  RefreshCcw, 
  Plus, 
  ExternalLink,
  AlertCircle
} from 'lucide-react-native';
import { THEME } from '../theme/theme';
import { API_BASE, PORT, LAN_HOST_IP } from '../api/config';
import { useMobileStore } from '../store/useMobileStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AcousticLensScreen() {
  const insets = useSafeAreaInsets();
  const { user, addCardToDeck, getApiBase } = useMobileStore();

  const MAX_RECORD_SECONDS = 6;
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [pulse, setPulse] = useState(1);
  const secondsTimerRef = useRef(null);
  const pulseTimerRef = useRef(null);
  const startTimeRef = useRef(0);

  // Accurate 1-second timer loop while recording (snappy 6-second auto-stop)
  useEffect(() => {
    if (isRecording) {
      startTimeRef.current = Date.now();
      secondsTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          if (s >= MAX_RECORD_SECONDS - 1) {
            // Auto stop after 6 seconds of recording for snappy UX
            stopAndAnalyze();
            return MAX_RECORD_SECONDS;
          }
          return s + 1;
        });
      }, 1000);

      // Smooth visual radar pulse (independent from seconds timer)
      let direction = 1;
      pulseTimerRef.current = setInterval(() => {
        setPulse((p) => {
          if (p >= 1.35) direction = -1;
          if (p <= 1.0) direction = 1;
          return Number((p + direction * 0.05).toFixed(2));
        });
      }, 100);
    } else {
      if (secondsTimerRef.current) clearInterval(secondsTimerRef.current);
      if (pulseTimerRef.current) clearInterval(pulseTimerRef.current);
      setPulse(1);
    }
    return () => {
      if (secondsTimerRef.current) clearInterval(secondsTimerRef.current);
      if (pulseTimerRef.current) clearInterval(pulseTimerRef.current);
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      setErrorMessage(null);
      setAnalysisResult(null);

      // 1. Explicitly request real hardware microphone permissions
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setErrorMessage(
          'Microphone permission is required to listen to real audio. Please enable microphone access for Expo Go in your phone settings.'
        );
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      // 2. Set audio mode for real hardware recording
      try {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true
        });
      } catch (e) {
        // non-fatal
      }

      // 3. Prepare and start real recording
      await recorder.prepareToRecordAsync();
      startTimeRef.current = Date.now();
      recorder.record();
      setRecordSeconds(0);
      setIsRecording(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      console.warn('Microphone start error:', err);
      setErrorMessage('Could not initialize microphone: ' + (err.message || 'Unknown error'));
      setIsRecording(false);
    }
  };

  const stopAndAnalyze = async () => {
    try {
      setIsRecording(false);
      if (secondsTimerRef.current) clearInterval(secondsTimerRef.current);
      if (pulseTimerRef.current) clearInterval(pulseTimerRef.current);

      try {
        await recorder.stop();
      } catch (stopErr) {
        console.warn('Recorder stop error:', stopErr);
      }

      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      if (elapsed < 1.8) {
        setIsAnalyzing(false);
        setErrorMessage(`Recording was only ${elapsed.toFixed(1)}s. Please sing, hum, or play music for at least 3-4 seconds!`);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIsAnalyzing(true);
      setErrorMessage(null);

      const recordedUri = recorder.uri;

      if (!recordedUri) {
        setIsAnalyzing(false);
        setErrorMessage('No audio data captured. Please hold your microphone closer and try again.');
        return;
      }

      // Read real hardware audio recording as Base64 (supporting legacy and modern File API)
      let base64Audio = null;
      try {
        base64Audio = await FileSystem.readAsStringAsync(recordedUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (readErr) {
        console.warn('legacy readAsStringAsync failed, attempting File fallback:', readErr);
        try {
          const file = new File(recordedUri);
          const bytes = await file.bytes();
          let binary = '';
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          base64Audio = global.btoa ? global.btoa(binary) : null;
        } catch (fErr) {
          console.warn('File fallback error:', fErr);
        }
      }

      if (!base64Audio) {
        setIsAnalyzing(false);
        setErrorMessage('Could not read recorded audio data from device storage. Please try again.');
        return;
      }

      // Send to FastAPI base64 endpoint (with automatic dynamic LAN IP failover)
      const primaryBase = (getApiBase && getApiBase()) || API_BASE;
      const candidates = [
        primaryBase,
        `http://${LAN_HOST_IP}:${PORT}`,
        `http://127.0.0.1:${PORT}`
      ].filter((v, i, a) => a.indexOf(v) === i);

      let response = null;
      let lastErr = null;

      for (const base of candidates) {
        try {
          response = await axios.post(
            `${base}/vibe/identify-audio-base64`,
            {
              audio_base64: base64Audio,
              mime_type: 'audio/m4a',
              user_id: user?.id || undefined,
            },
            {
              timeout: 45000,
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
            }
          );
          if (response && response.data) {
            useMobileStore.setState({ apiBase: base });
            break;
          }
        } catch (postErr) {
          lastErr = postErr;
          console.warn(`AcousticLens probe failed on ${base}:`, postErr.message);
        }
      }

      if (!response) {
        throw lastErr || new Error('Could not connect to FastAPI server');
      }

      const data = response.data;
      setIsAnalyzing(false);

      if (data.status === 'success' || data.status === 'candidates') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setAnalysisResult(data);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setErrorMessage(
          data.message || 'No clear singing, melody, or music was recognized. Please try singing a chorus or holding phone closer to speaker!'
        );
      }
    } catch (err) {
      console.warn('Analysis error:', err);
      setIsAnalyzing(false);
      const detail = err.response?.data?.detail || err.message || 'Network error during analysis';
      if (err.response || err.code === 'ECONNABORTED' || (err.message && err.message.includes('Network'))) {
        setErrorMessage(`${detail}. Make sure FastAPI backend is reachable on your PC.`);
      } else {
        setErrorMessage(detail);
      }
    }
  };

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Math.max(insets.top + 6, 20),
          paddingBottom: Math.max(insets.bottom + 80, 100)
        }
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Acoustic Lens</Text>
        <Text style={styles.subtitle}>
          Real-time microphone capture · Gemini 3.5 Flash DSP · Neo4j Graph-RAG
        </Text>
      </View>

      {/* Center Microphone Radar Orb */}
      <View style={styles.radarContainer}>
        {/* Animated Radial Pulse Rings */}
        <View style={[styles.pulseRing, { transform: [{ scale: isRecording ? pulse : 1 }] }]} />
        <View style={[styles.pulseRingInner, { transform: [{ scale: isRecording ? pulse * 0.85 : 1 }] }]} />

        {/* Center Microphone Button */}
        <Pressable
          style={[
            styles.centerOrb,
            isRecording && styles.centerOrbRecording,
            isAnalyzing && styles.centerOrbAnalyzing
          ]}
          disabled={isAnalyzing}
          onPress={isRecording ? stopAndAnalyze : startRecording}
        >
          {isAnalyzing ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : isRecording ? (
            <Square size={32} color="#FFFFFF" fill="#FFFFFF" />
          ) : (
            <Mic size={38} color="#FFFFFF" strokeWidth={2.2} />
          )}
        </Pressable>
      </View>

      {/* Recording Status & Live Timer */}
      <View style={styles.statusBox}>
        {isAnalyzing ? (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={THEME.colors.accent} />
            <Text style={styles.statusText}>Analyzing Audio Spectrum with Graph-RAG...</Text>
          </View>
        ) : isRecording ? (
          <View style={styles.statusRow}>
            <View style={styles.recordingDot} />
            <Text style={[styles.statusText, { color: recordSeconds >= 3 ? '#10B981' : '#EF4444' }]}>
              {recordSeconds >= 3 ? '⚡ Tap Orb to identify now • ' : 'Listening: '}
              {formatTimer(recordSeconds)} / {formatTimer(MAX_RECORD_SECONDS)}
            </Text>
          </View>
        ) : (
          <Text style={styles.statusText}>
            Tap Orb to Sing, Hum, or Identify Ambient Music
          </Text>
        )}
      </View>

      {/* Error / Permission Banner */}
      {errorMessage && (
        <View style={styles.errorCard}>
          <AlertCircle size={18} color="#EF4444" />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {/* Real Hardware Analysis Result Card */}
      {analysisResult && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Sparkles size={16} color={THEME.colors.accent} />
            <Text style={styles.resultHeaderTitle}>
              {analysisResult.match_tier === 'tier1_landmark'
                ? '⚡ Landmark Master Match'
                : analysisResult.status === 'candidates'
                ? '🎶 Melodic Candidates'
                : '🧠 Neuro-Acoustic Match'}
            </Text>
            <View style={[
              styles.confidenceBadge,
              analysisResult.status === 'candidates' && { backgroundColor: 'rgba(234, 179, 8, 0.15)', borderColor: 'rgba(234, 179, 8, 0.4)' }
            ]}>
              <Text style={[
                styles.confidenceText,
                analysisResult.status === 'candidates' && { color: '#EAB308' }
              ]}>
                {Math.round((analysisResult.confidence || 0.9) * 100)}% Confident
              </Text>
            </View>
          </View>

          {analysisResult.mode === 'CHIMERIC_MASHUP_DETECTED' ? (
            /* DUAL-CARD MASHUP VIEW */
            <View style={styles.mashupContainer}>
              <View style={styles.mashupNotice}>
                <Sparkles size={16} color="#EC4899" />
                <Text style={styles.mashupNoticeText}>
                  {analysisResult.explanation || 'Chimeric Mashup Detected!'}
                </Text>
              </View>

              {/* Card 1: Matched Sung Lyrics */}
              {analysisResult.lyric_match && (
                <View style={styles.mashupCard}>
                  <View style={styles.mashupCardHeader}>
                    <Text style={styles.mashupBadgeText}>📝 MATCHED YOUR SUNG LYRICS</Text>
                    <Text style={styles.mashupConfText}>
                      {Math.round(analysisResult.lyric_match.confidence * 100)}%
                    </Text>
                  </View>
                  <View style={styles.songRow}>
                    {analysisResult.lyric_match.thumbnail ? (
                      <Image source={{ uri: analysisResult.lyric_match.thumbnail }} style={styles.songCover} />
                    ) : (
                      <View style={styles.coverFallback}><Radio size={22} color={THEME.colors.accent} /></View>
                    )}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.songTitle} numberOfLines={1}>{analysisResult.lyric_match.title}</Text>
                      <Text style={styles.songArtist} numberOfLines={1}>{analysisResult.lyric_match.artist}</Text>
                    </View>
                    {analysisResult.lyric_match.youtube_url && (
                      <Pressable
                        style={styles.mashupPlayBtn}
                        onPress={() => Linking.openURL(analysisResult.lyric_match.youtube_url)}
                      >
                        <ExternalLink size={14} color="#FFF" />
                      </Pressable>
                    )}
                  </View>
                </View>
              )}

              {/* Card 2: Matched Melody & Beat */}
              {analysisResult.melody_match && (
                <View style={[styles.mashupCard, { borderColor: 'rgba(168, 85, 247, 0.4)' }]}>
                  <View style={styles.mashupCardHeader}>
                    <Text style={[styles.mashupBadgeText, { color: THEME.colors.accent }]}>🎶 MATCHED YOUR MELODY & BEAT</Text>
                    <Text style={styles.mashupConfText}>
                      {Math.round(analysisResult.melody_match.confidence * 100)}%
                    </Text>
                  </View>
                  <View style={styles.songRow}>
                    {analysisResult.melody_match.thumbnail ? (
                      <Image source={{ uri: analysisResult.melody_match.thumbnail }} style={styles.songCover} />
                    ) : (
                      <View style={styles.coverFallback}><Radio size={22} color={THEME.colors.accent} /></View>
                    )}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.songTitle} numberOfLines={1}>{analysisResult.melody_match.title}</Text>
                      <Text style={styles.songArtist} numberOfLines={1}>{analysisResult.melody_match.artist}</Text>
                    </View>
                    {analysisResult.melody_match.youtube_url && (
                      <Pressable
                        style={styles.mashupPlayBtn}
                        onPress={() => Linking.openURL(analysisResult.melody_match.youtube_url)}
                      >
                        <ExternalLink size={14} color="#FFF" />
                      </Pressable>
                    )}
                  </View>
                </View>
              )}
            </View>
          ) : (
            /* STANDARD SINGLE SONG CARD */
            <>
              <View style={styles.songRow}>
                {analysisResult.thumbnail ? (
                  <Image source={{ uri: analysisResult.thumbnail }} style={styles.songCover} />
                ) : (
                  <View style={styles.coverFallback}>
                    <Radio size={24} color={THEME.colors.accent} />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.songTitle} numberOfLines={1}>
                    {analysisResult.title || 'Recognized Song'}
                  </Text>
                  <Text style={styles.songArtist} numberOfLines={1}>
                    {analysisResult.artist || 'Featured Artist'}
                  </Text>

                  {/* Musical Signal DSP Info */}
                  <View style={styles.dspRow}>
                    {analysisResult.tempo_bpm > 0 && (
                      <View style={styles.dspPill}>
                        <Text style={styles.dspPillText}>{analysisResult.tempo_bpm} BPM</Text>
                      </View>
                    )}
                    {analysisResult.timbre_type && (
                      <View style={styles.dspPill}>
                        <Text style={styles.dspPillText}>{analysisResult.timbre_type}</Text>
                      </View>
                    )}
                    {analysisResult.dominant_keys && analysisResult.dominant_keys.length > 0 && (
                      <View style={styles.dspPill}>
                        <Text style={styles.dspPillText}>Key: {analysisResult.dominant_keys.slice(0, 2).join(', ')}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Transcribed Lyrics / Vocal Hook */}
              {analysisResult.detected_lyrics && (
                <View style={styles.lyricsBox}>
                  <Text style={styles.lyricsLabel}>TRANSCRIBED VOCALS / HOOK</Text>
                  <Text style={styles.lyricsText}>"{analysisResult.detected_lyrics}"</Text>
                </View>
              )}

              {/* Harmonic Vibe Reasoning */}
              {analysisResult.explanation && (
                <Text style={styles.vibeDescription}>
                  {analysisResult.explanation}
                </Text>
              )}
            </>
          )}

          {/* Action Buttons */}
          <View style={styles.actionBtnRow}>
            {/* Add to Curated Deck */}
            {analysisResult.card && (
              <Pressable
                style={styles.addDeckBtn}
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  addCardToDeck(analysisResult.card);
                }}
              >
                <Plus size={16} color="#FFFFFF" />
                <Text style={styles.addDeckBtnText}>Add to Curated Deck</Text>
              </Pressable>
            )}

            {/* Open in YouTube */}
            {analysisResult.youtube_url && (
              <Pressable
                style={styles.youtubeLinkBtn}
                onPress={() => Linking.openURL(analysisResult.youtube_url)}
              >
                <ExternalLink size={14} color="#FFF" />
              </Pressable>
            )}
          </View>

          {/* Candidate Matches (Humming / Disambiguation) */}
          {analysisResult.candidates && analysisResult.candidates.length > 0 && (
            <View style={styles.candidatesSection}>
              <Text style={styles.candidatesTitle}>
                {analysisResult.status === 'candidates' ? 'TOP CANDIDATE MATCHES (TAP TO PREVIEW)' : 'ALTERNATIVE MELODIC MATCHES'}
              </Text>
              {analysisResult.candidates.map((cand, idx) => (
                <Pressable
                  key={idx}
                  style={styles.candidateRow}
                  onPress={() => {
                    if (cand.youtube_url) {
                      Linking.openURL(cand.youtube_url);
                    }
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.candTitle} numberOfLines={1}>{cand.title}</Text>
                    <Text style={styles.candArtist} numberOfLines={1}>{cand.artist}</Text>
                    <Text style={styles.candReason}>{cand.reason}</Text>
                  </View>
                  {cand.youtube_url && (
                    <View style={styles.candLinkBtn}>
                      <ExternalLink size={14} color={THEME.colors.accent} />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  content: {
    paddingHorizontal: 22,
    alignItems: 'center'
  },
  header: {
    alignItems: 'center',
    marginBottom: 28
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.colors.textPrimary
  },
  subtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 290
  },
  radarContainer: {
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },
  pulseRing: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    backgroundColor: 'rgba(168, 85, 247, 0.05)'
  },
  pulseRingInner: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)'
  },
  centerOrb: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: THEME.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#A855F7',
    shadowOpacity: 0.5,
    shadowRadius: 16
  },
  centerOrbRecording: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444'
  },
  centerOrbAnalyzing: {
    backgroundColor: '#7C3AED'
  },
  statusBox: {
    marginTop: 20,
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444'
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    width: '100%',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: THEME.radius.md,
    padding: 14
  },
  errorText: {
    flex: 1,
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 16
  },
  resultCard: {
    marginTop: 22,
    width: '100%',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.colors.borderActive
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14
  },
  resultHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    flex: 1
  },
  confidenceBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#22C55E'
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  songCover: {
    width: 60,
    height: 60,
    borderRadius: THEME.radius.md
  },
  coverFallback: {
    width: 60,
    height: 60,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center'
  },
  songTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.colors.textPrimary
  },
  songArtist: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
    marginTop: 2
  },
  dspRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6
  },
  dspPill: {
    backgroundColor: THEME.colors.surfaceElevated,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 4
  },
  dspPillText: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  lyricsBox: {
    marginTop: 14,
    backgroundColor: THEME.colors.surfaceElevated,
    padding: 12,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle
  },
  lyricsLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8
  },
  lyricsText: {
    fontSize: 13,
    color: '#E9D5FF',
    fontStyle: 'italic',
    marginTop: 4
  },
  vibeDescription: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 10,
    lineHeight: 16
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16
  },
  addDeckBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.colors.accent,
    paddingVertical: 12,
    borderRadius: THEME.radius.md
  },
  addDeckBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  youtubeLinkBtn: {
    width: 44,
    height: 44,
    borderRadius: THEME.radius.md,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center'
  },
  candidatesSection: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderSubtle
  },
  candidatesTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8
  },
  candidateRow: {
    backgroundColor: THEME.colors.surfaceElevated,
    padding: 12,
    borderRadius: THEME.radius.sm,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle
  },
  candLinkBtn: {
    padding: 6,
    marginLeft: 8
  },
  candTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: THEME.colors.textPrimary
  },
  candArtist: {
    fontSize: 11,
    color: THEME.colors.textSecondary
  },
  candReason: {
    fontSize: 10.5,
    color: THEME.colors.textMuted,
    marginTop: 2
  },
  mashupContainer: {
    width: '100%',
    marginTop: 8
  },
  mashupNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.35)',
    padding: 10,
    borderRadius: THEME.radius.md,
    marginBottom: 12,
    gap: 8
  },
  mashupNoticeText: {
    fontSize: 12,
    color: '#F472B6',
    fontWeight: '700',
    flex: 1,
    lineHeight: 16
  },
  mashupCard: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.3)',
    borderRadius: THEME.radius.md,
    padding: 12,
    marginBottom: 10
  },
  mashupCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  mashupBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F472B6',
    letterSpacing: 0.8
  },
  mashupConfText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#A855F7'
  },
  mashupPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8
  }
});
