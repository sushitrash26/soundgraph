import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Image,
  ScrollView,
  Linking,
  Dimensions,
  Modal
} from 'react-native';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import axios from 'axios';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync
} from 'expo-audio';
import {
  Mic,
  Sparkles,
  Check,
  Play,
  Pause,
  ExternalLink,
  ChevronRight,
  Layers,
  Clock,
  Radio,
  Music2,
  X,
  Volume2
} from 'lucide-react-native';
import { THEME } from '../theme/theme';
import { API_BASE, PORT, LAN_HOST_IP } from '../api/config';
import { useMobileStore } from '../store/useMobileStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AmbientGlassBackground from '../components/AmbientGlassBackground';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AcousticLensScreen() {
  const insets = useSafeAreaInsets();
  const {
    user,
    getApiBase,
    toggleAudioPreview,
    playingTrackId,
    isPlayingAudio,
    addTrackToCustomDeck
  } = useMobileStore();

  const [activeTab, setActiveTab] = useState('listen'); // 'listen' | 'history'
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [pulse, setPulse] = useState(1);

  const MAX_RECORD_SECONDS = 7;
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const secondsTimerRef = useRef(null);
  const pulseTimerRef = useRef(null);
  const startTimeRef = useRef(0);

  // Pulse animation during recording
  useEffect(() => {
    if (isRecording) {
      startTimeRef.current = Date.now();
      secondsTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          if (s >= MAX_RECORD_SECONDS - 1) {
            stopAndAnalyze();
            return MAX_RECORD_SECONDS;
          }
          return s + 1;
        });
      }, 1000);

      let direction = 1;
      pulseTimerRef.current = setInterval(() => {
        setPulse((p) => {
          if (p >= 1.25) direction = -1;
          if (p <= 1.0) direction = 1;
          return Number((p + direction * 0.04).toFixed(2));
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

  // Load history when tab switches to 'history'
  useEffect(() => {
    if (activeTab === 'history') {
      fetch30DayHistory();
    }
  }, [activeTab]);

  const fetch30DayHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const base = (getApiBase && getApiBase()) || API_BASE;
      const uid = user?.id ? `?user_id=${encodeURIComponent(user.id)}&days=30` : '?days=30';
      const res = await axios.get(`${base}/vibe/history${uid}`);
      if (Array.isArray(res.data)) {
        setHistoryItems(res.data);
      }
    } catch (e) {
      console.warn('Error fetching 30-day lens history:', e.message);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const startRecording = async () => {
    try {
      setErrorMessage(null);
      setAnalysisResult(null);

      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setErrorMessage(
          'Microphone permission is required to listen to real audio. Please enable microphone in phone settings.'
        );
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      try {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true
        });
      } catch (e) {
        // non-fatal
      }

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
      if (elapsed < 1.5) {
        setIsAnalyzing(false);
        setErrorMessage(`Recording was only ${elapsed.toFixed(1)}s. Please hold for at least 3 seconds!`);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIsAnalyzing(true);
      setErrorMessage(null);

      const recordedUri = recorder.uri;
      if (!recordedUri) {
        setIsAnalyzing(false);
        setErrorMessage('No audio data captured. Please try again.');
        return;
      }

      let base64Audio = null;
      try {
        base64Audio = await FileSystem.readAsStringAsync(recordedUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (readErr) {
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
        setErrorMessage('Could not read audio data. Please try again.');
        return;
      }

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
        // Refresh history cache in background
        fetch30DayHistory();
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setErrorMessage(
          data.message || 'No clear singing or music was recognized. Please try humming in a quieter spot or holding closer to speaker!'
        );
      }
    } catch (err) {
      console.warn('Analysis error:', err);
      setIsAnalyzing(false);
      setErrorMessage(err.response?.data?.detail || err.message || 'Audio identification error');
    }
  };

  const matchedTrack = analysisResult?.match || analysisResult?.top_match || analysisResult;
  const matchTitle = matchedTrack?.title || matchedTrack?.name || 'Identified Track';
  const matchArtist = matchedTrack?.artist || (Array.isArray(matchedTrack?.artists) ? matchedTrack.artists.join(', ') : 'Featured Artist');
  const matchCover = matchedTrack?.thumbnail || matchedTrack?.cover_url || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600';
  const matchConfidence = Math.round((analysisResult?.confidence || 0.95) * 100);

  const isPlayingMatched = isPlayingAudio && playingTrackId === (matchedTrack?.track_id || matchedTrack?.id);

  const handleAddMatchedToCustomDeck = () => {
    if (!matchedTrack) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addTrackToCustomDeck(0, {
      id: matchedTrack.track_id || matchedTrack.id || `rec_${Date.now()}`,
      title: matchTitle,
      artist: matchArtist,
      cover_url: matchCover,
      preview_url: matchedTrack.preview_url || matchedTrack.youtube_url || ''
    });
    setAnalysisResult(null);
  };

  return (
    <View style={[
      styles.container,
      {
        paddingTop: Math.max(insets.top + 6, 12),
        paddingBottom: Math.max(insets.bottom + 80, 94)
      }
    ]}>
      <AmbientGlassBackground />

      {/* Header matching profile/App.jsx */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>SOUNDPORT LENS</Text>
        <Text style={styles.title}>Name that sound</Text>
      </View>

      {/* Segmented Pill Switcher: [ Listen ] [ Your history ] */}
      <View style={styles.pillSwitcherWrapper}>
        <Pressable
          style={[
            styles.pillTab,
            activeTab === 'listen' ? styles.pillTabActive : styles.pillTabInactive
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab('listen');
          }}
        >
          <Text
            style={[
              styles.pillTabText,
              activeTab === 'listen' ? styles.pillTabTextActive : styles.pillTabTextInactive
            ]}
          >
            Listen
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.pillTab,
            activeTab === 'history' ? styles.pillTabActive : styles.pillTabInactive
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab('history');
          }}
        >
          <Text
            style={[
              styles.pillTabText,
              activeTab === 'history' ? styles.pillTabTextActive : styles.pillTabTextInactive
            ]}
          >
            Your history
          </Text>
        </Pressable>
      </View>

      {/* TAB CONTENT: LISTEN */}
      {activeTab === 'listen' && (
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
        >
          {/* Radar Visualization Arena matching profile/App.jsx */}
          <View style={styles.radarArena}>
            {/* Ambient Purple Blur Glow */}
            <View style={styles.ambientPurpleGlow} />

            {/* Concentric Orbits */}
            <View
              style={[
                styles.lensOrbit,
                styles.orbitOuter,
                isRecording && { transform: [{ scale: pulse * 1.08 }] }
              ]}
            />
            <View
              style={[
                styles.lensOrbit,
                styles.orbitInner,
                isRecording && { transform: [{ scale: pulse }] }
              ]}
            />

            {/* Center Core Microphone Button */}
            <Pressable
              style={({ pressed }) => [
                styles.listenCore,
                isRecording && styles.listenCoreActive,
                pressed && { transform: [{ scale: 0.95 }] }
              ]}
              disabled={isAnalyzing}
              onPress={isRecording ? stopAndAnalyze : startRecording}
            >
              {isAnalyzing ? (
                <View style={styles.analyzingCenter}>
                  <ActivityIndicator size="large" color="#d7ff64" />
                  <Text style={styles.analyzingText}>Identifying…</Text>
                </View>
              ) : isRecording ? (
                <View style={styles.listeningCenter}>
                  <Volume2 size={38} color="#000000" strokeWidth={2.4} />
                  <Text style={styles.listeningText}>Listening</Text>
                  <Text style={styles.recordTimerText}>{recordSeconds}s / {MAX_RECORD_SECONDS}s</Text>
                </View>
              ) : (
                <View style={styles.idleCenter}>
                  <Mic size={42} color="#000000" strokeWidth={2.4} />
                  <Text style={styles.tapToListenText}>Tap to listen</Text>
                </View>
              )}
            </Pressable>

            {/* Animated Equalizer Wave Bars while listening */}
            {isRecording && (
              <View style={styles.listeningBarsRow}>
                {[4, 8, 14, 18, 12, 6].map((h, i) => (
                  <View
                    key={i}
                    style={[
                      styles.listeningBar,
                      { height: Math.max(6, (h * pulse).toFixed(0)) }
                    ]}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Status Message Text */}
          <View style={styles.statusSection}>
            <Text style={styles.statusTitle}>
              {isAnalyzing
                ? 'Synthesizing with HexaSonic…'
                : isRecording
                  ? 'Hold that sound…'
                  : 'Play it. Hum it. Find it.'}
            </Text>
            <Text style={styles.statusSubtitle}>
              {isAnalyzing
                ? 'Searching 100M+ global audio landmark acoustic constellations.'
                : isRecording
                  ? 'Lens is separating melody from background acoustic noise.'
                  : 'Soundport Lens identifies music around you or the tune stuck in your head.'}
            </Text>
          </View>

          {errorMessage && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Tip Glass Panel matching profile/App.jsx */}
          <View style={styles.tipCard}>
            <View style={styles.tipIconBadge}>
              <Sparkles size={18} color="#d7ff64" />
            </View>
            <View style={styles.tipMeta}>
              <Text style={styles.tipTitle}>Better humming matches</Text>
              <Text style={styles.tipDescription}>
                Hum for at least 4-6 seconds in a quiet space for optimal pitch tracking.
              </Text>
            </View>
            <ChevronRight size={16} color="rgba(255, 255, 255, 0.25)" />
          </View>
        </ScrollView>
      )}

      {/* TAB CONTENT: YOUR HISTORY (Past 30 Days) */}
      {activeTab === 'history' && (
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.historyScrollInner}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.historyHeaderRow}>
            <Text style={styles.historyTitle}>Searches (Past 30 days)</Text>
            <Text style={styles.historyCountText}>{historyItems.length} found</Text>
          </View>

          {isLoadingHistory ? (
            <View style={styles.loadingHistoryView}>
              <ActivityIndicator size="small" color="#d7ff64" />
              <Text style={styles.loadingHistoryText}>Loading search timeline…</Text>
            </View>
          ) : historyItems.length === 0 ? (
            <View style={styles.emptyHistoryCard}>
              <Clock size={32} color="rgba(255, 255, 255, 0.35)" style={{ marginBottom: 10 }} />
              <Text style={styles.emptyHistoryTitle}>No searches in past 30 days</Text>
              <Text style={styles.emptyHistorySubtitle}>
                Any songs you identify with Soundport Lens will be safely kept in your 30-day timeline.
              </Text>
              <Pressable
                onPress={() => setActiveTab('listen')}
                style={styles.listenNowButton}
              >
                <Text style={styles.listenNowButtonText}>Listen to a song now</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.historyList}>
              {historyItems.map((item) => (
                <View key={item.id} style={styles.historyRow}>
                  <Image
                    source={{ uri: item.thumbnail || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600' }}
                    style={styles.historyThumbnail}
                  />
                  <View style={styles.historyMeta}>
                    <Text style={styles.historySongTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.historySongArtist} numberOfLines={1}>
                      {item.artist}
                    </Text>
                    <View style={styles.historyBadgeRow}>
                      <View style={styles.confidenceBadge}>
                        <Text style={styles.confidenceText}>
                          {Math.round((item.confidence || 0.95) * 100)}% match
                        </Text>
                      </View>
                      <Text style={styles.historyTimestamp}>
                        {item.created_at ? item.created_at.split(' ')[0] : 'Recent'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.historyActions}>
                    {item.youtube_url ? (
                      <Pressable
                        onPress={() => Linking.openURL(item.youtube_url)}
                        style={styles.historyActionBtn}
                      >
                        <ExternalLink size={16} color="#FFFFFF" />
                      </Pressable>
                    ) : null}

                    <Pressable
                      onPress={() => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        addTrackToCustomDeck(0, {
                          id: item.id,
                          title: item.title,
                          artist: item.artist,
                          cover_url: item.thumbnail,
                          preview_url: item.preview_url || item.youtube_url || ''
                        });
                      }}
                      style={[styles.historyActionBtn, styles.historyAddDeckBtn]}
                    >
                      <Layers size={15} color="#000000" strokeWidth={2.4} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Match Found Result Modal Sheet matching profile/App.jsx lines 650-690 */}
      <Modal
        visible={!!analysisResult}
        transparent
        animationType="fade"
        onRequestClose={() => setAnalysisResult(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setAnalysisResult(null)}
          />

          <View style={[styles.resultSheet, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
            <Image
              source={{ uri: matchCover }}
              style={styles.resultCoverImage}
            />

            <View style={styles.resultDetailsSection}>
              {/* Match Found Tag */}
              <View style={styles.matchFoundTag}>
                <Check size={14} color="#d7ff64" strokeWidth={3} />
                <Text style={styles.matchFoundText}>MATCH FOUND · {matchConfidence}% ACCURACY</Text>
              </View>

              <View style={styles.resultTitleRow}>
                <View style={styles.resultTitleCol}>
                  <Text style={styles.resultSongTitle} numberOfLines={1}>
                    {matchTitle}
                  </Text>
                  <Text style={styles.resultSongArtist} numberOfLines={1}>
                    {matchArtist}
                  </Text>
                </View>

                {matchedTrack?.preview_url ? (
                  <Pressable
                    onPress={() => toggleAudioPreview(matchedTrack)}
                    style={styles.resultPlayButton}
                  >
                    {isPlayingMatched ? (
                      <Pause size={18} color="#000000" />
                    ) : (
                      <Play size={18} color="#000000" fill="#000000" />
                    )}
                  </Pressable>
                ) : null}
              </View>

              {/* Action Buttons */}
              <View style={styles.resultActionsCol}>
                <Pressable
                  onPress={handleAddMatchedToCustomDeck}
                  style={styles.addToDeckCtaButton}
                >
                  <Layers size={16} color="#000000" strokeWidth={2.4} />
                  <Text style={styles.addToDeckCtaText}>Save to my custom deck</Text>
                </Pressable>

                {matchedTrack?.youtube_url ? (
                  <Pressable
                    onPress={() => Linking.openURL(matchedTrack.youtube_url)}
                    style={styles.openExternalButton}
                  >
                    <ExternalLink size={15} color="#FFFFFF" />
                    <Text style={styles.openExternalText}>Open in YouTube Music</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: 16
  },
  header: {
    paddingHorizontal: 4,
    paddingTop: 4,
    marginBottom: 14
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#d7ff64',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 4
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.6
  },
  pillSwitcherWrapper: {
    flexDirection: 'row',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 3,
    marginBottom: 16
  },
  pillTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pillTabActive: {
    backgroundColor: '#FFFFFF'
  },
  pillTabInactive: {
    backgroundColor: 'transparent'
  },
  pillTabText: {
    fontSize: 12.5,
    fontWeight: '700'
  },
  pillTabTextActive: {
    color: '#000000'
  },
  pillTabTextInactive: {
    color: 'rgba(255, 255, 255, 0.45)'
  },
  scrollContent: {
    flex: 1
  },
  scrollInner: {
    alignItems: 'center',
    paddingBottom: 24
  },
  radarArena: {
    width: '100%',
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginVertical: 10
  },
  ambientPurpleGlow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(139, 92, 246, 0.12)'
  },
  lensOrbit: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)'
  },
  orbitOuter: {
    width: 250,
    height: 250
  },
  orbitInner: {
    width: 200,
    height: 200
  },
  listenCore: {
    width: 154,
    height: 154,
    borderRadius: 77,
    backgroundColor: '#d7ff64',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#d7ff64',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
    zIndex: 10
  },
  listenCoreActive: {
    backgroundColor: '#ff817a',
    shadowColor: '#ff817a'
  },
  idleCenter: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  tapToListenText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginTop: 8
  },
  listeningCenter: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  listeningText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginTop: 4
  },
  recordTimerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000000',
    marginTop: 2
  },
  analyzingCenter: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  analyzingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
    marginTop: 8
  },
  listeningBarsRow: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4
  },
  listeningBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: '#d7ff64'
  },
  statusSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 20
  },
  statusTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    textAlign: 'center'
  },
  statusSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.45)',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
    maxWidth: 290
  },
  errorBanner: {
    width: '100%',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16
  },
  errorText: {
    color: '#ff817a',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center'
  },
  tipCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 14
  },
  tipIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(215, 255, 100, 0.1)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  tipMeta: {
    flex: 1
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  tipDescription: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 2,
    lineHeight: 15
  },
  historyScrollInner: {
    paddingBottom: 24
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 4
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  historyCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d7ff64'
  },
  loadingHistoryView: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 32
  },
  loadingHistoryText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)'
  },
  emptyHistoryCard: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 20
  },
  emptyHistoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6
  },
  emptyHistorySubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.45)',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 20
  },
  listenNowButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 9999
  },
  listenNowButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000'
  },
  historyList: {
    gap: 10
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 10
  },
  historyThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
  },
  historyMeta: {
    flex: 1
  },
  historySongTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  historySongArtist: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.55)',
    marginTop: 2
  },
  historyBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 5
  },
  confidenceBadge: {
    backgroundColor: 'rgba(215, 255, 100, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  confidenceText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#d7ff64'
  },
  historyTimestamp: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.35)'
  },
  historyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  historyActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  historyAddDeckBtn: {
    backgroundColor: '#d7ff64'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 12
  },
  resultSheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#161514',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.45,
    shadowRadius: 20
  },
  resultCoverImage: {
    width: '100%',
    height: 220,
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
  },
  resultDetailsSection: {
    padding: 18
  },
  matchFoundTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8
  },
  matchFoundText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#d7ff64',
    letterSpacing: 1.6
  },
  resultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18
  },
  resultTitleCol: {
    flex: 1,
    marginRight: 10
  },
  resultSongTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4
  },
  resultSongArtist: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2
  },
  resultPlayButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#d7ff64',
    justifyContent: 'center',
    alignItems: 'center'
  },
  resultActionsCol: {
    gap: 10
  },
  addToDeckCtaButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 13,
    borderRadius: 9999
  },
  addToDeckCtaText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000'
  },
  openExternalButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    borderRadius: 9999
  },
  openExternalText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});
