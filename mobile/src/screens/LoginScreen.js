import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Image,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Dimensions
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import {
  Disc3,
  Music2,
  Radio,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Lock,
  X,
  Laptop,
  ClipboardPaste,
  HelpCircle,
  RefreshCw,
  CheckCircle2
} from 'lucide-react-native';
import { THEME } from '../theme/theme';
import { useMobileStore } from '../store/useMobileStore';
import AmbientGlassBackground from '../components/AmbientGlassBackground';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function LoginScreen({ onClose }) {
  const {
    user,
    isAuthenticated,
    loginWithGoogle,
    loginWithSpotify,
    loginAsGuest,
    logoutUser,
    setOnboardingStep,
    exchangeAuthCode,
    triggerPcLogin,
    checkBackendConnection
  } = useMobileStore();

  const [loadingPlatform, setLoadingPlatform] = useState(null);
  const [showRescueInput, setShowRescueInput] = useState(false);
  const [pastedUrl, setPastedUrl] = useState('');
  const [rescueError, setRescueError] = useState(null);
  const [pcSyncActive, setPcSyncActive] = useState(false);
  const [pcSyncMessage, setPcSyncMessage] = useState('');

  const handleSpotifyLogin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoadingPlatform('spotify');
    try {
      await loginWithSpotify();
    } finally {
      setLoadingPlatform(null);
    }
  };

  const handleYouTubeLogin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoadingPlatform('google');
    try {
      await loginWithGoogle();
    } finally {
      setLoadingPlatform(null);
    }
  };

  const handlePcSync = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPcSyncActive(true);
    setPcSyncMessage('Opening Google Login on your computer...');
    try {
      const res = await triggerPcLogin('google', (status) => {
        if (status === 'waiting_for_pc') {
          setPcSyncMessage('Waiting for Google login on PC... Click your account on computer!');
        } else if (status === 'success') {
          setPcSyncMessage('Account synced successfully!');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (status === 'timeout') {
          setPcSyncMessage('PC sync timed out. Try again or paste callback URL.');
          setPcSyncActive(false);
        }
      });
      if (res?.success) {
        if (onClose) onClose();
      }
    } catch (err) {
      setPcSyncMessage('Could not trigger PC login: ' + err.message);
      setPcSyncActive(false);
    }
  };

  const handleCheckActivePcSession = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoadingPlatform('check_pc');
    try {
      await checkBackendConnection();
      const currentUser = useMobileStore.getState().user;
      if (currentUser) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (onClose) onClose();
        setOnboardingStep('quiz');
      } else {
        setRescueError('No active PC session detected yet. Click "Sign in via PC" first!');
        setShowRescueInput(true);
      }
    } finally {
      setLoadingPlatform(null);
    }
  };

  const handlePasteFromClipboard = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRescueError(null);
    try {
      const text = await Clipboard.getStringAsync();
      if (!text || text.trim().length === 0) {
        setRescueError('Clipboard is empty! Copy the URL from your phone browser address bar first.');
        return;
      }
      setPastedUrl(text.trim());
      await executeCodeExchange(text.trim());
    } catch (e) {
      setRescueError('Failed to read clipboard: ' + e.message);
    }
  };

  const executeCodeExchange = async (urlOrCode) => {
    setLoadingPlatform('exchange');
    setRescueError(null);
    try {
      const res = await exchangeAuthCode(urlOrCode, 'google');
      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (onClose) onClose();
      } else {
        setRescueError(res.error || 'Failed to exchange code. Ensure you copied the full URL.');
      }
    } finally {
      setLoadingPlatform(null);
    }
  };

  const handleGuestEntry = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoadingPlatform('guest');
    await loginAsGuest();
    setLoadingPlatform(null);
  };

  const handleContinueExisting = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (onClose) onClose();
    setOnboardingStep('quiz');
  };

  return (
    <View style={styles.container}>
      <AmbientGlassBackground />

      {/* Dismiss Button if opened as modal */}
      {onClose && (
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <BlurView intensity={70} tint="light" style={styles.closeBlur}>
            <X size={18} color="#FFFFFF" />
          </BlurView>
        </Pressable>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Editorial Brand Header */}
        <View style={styles.headerSection}>
          <View style={styles.logoBadgeContainer}>
            <BlurView intensity={80} tint="light" style={styles.logoBadgeBlur}>
              <Disc3 size={32} color="#FFFFFF" strokeWidth={2} />
            </BlurView>
          </View>

          <Text style={styles.brandTitle}>SoundGraph</Text>
          <Text style={styles.brandTagline}>Autonomous Sonic Discovery</Text>
          <Text style={styles.brandDescription}>
            Connect your music library to unlock 24/7 cross-platform taste alignment, curated feeds, and lossless migration.
          </Text>
        </View>

        {/* Main Glassmorphic Action Card */}
        <View style={styles.cardContainer}>
          {isAuthenticated && user ? (
            // Active Authenticated State
            <BlurView intensity={75} tint="light" style={styles.glassCardBlur}>
              <View style={styles.userRow}>
                {user.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitial}>{user.name ? user.name[0] : 'U'}</Text>
                  </View>
                )}
                <View style={styles.userInfo}>
                  <View style={styles.sessionStatusRow}>
                    <ShieldCheck size={13} color={THEME.colors.success} />
                    <Text style={styles.sessionStatusText}>ACTIVE SESSION</Text>
                  </View>
                  <Text style={styles.userName} numberOfLines={1}>{user.name || 'Sonic Explorer'}</Text>
                  <Text style={styles.userId} numberOfLines={1}>{user.id}</Text>
                </View>
              </View>

              {/* Solid White Action Pill */}
              <Pressable
                style={({ pressed }) => [
                  styles.solidWhiteButton,
                  pressed && styles.buttonPressed
                ]}
                onPress={handleContinueExisting}
              >
                <Text style={styles.solidWhiteButtonText}>Continue to Vibe Setup</Text>
                <ArrowRight size={16} color="#181716" />
              </Pressable>

              <Pressable style={styles.signOutButton} onPress={logoutUser}>
                <Text style={styles.signOutText}>Sign out from this session</Text>
              </Pressable>
            </BlurView>
          ) : (
            // Unauthenticated Connection Options
            <View style={styles.optionsList}>
              {/* PC Instant Sync Option (Top recommendation to avoid 127.0.0.1 loopback issue) */}
              <Pressable
                style={({ pressed }) => [
                  styles.glassTile,
                  styles.pcSyncTile,
                  pressed && styles.buttonPressed
                ]}
                onPress={handlePcSync}
                disabled={loadingPlatform !== null || pcSyncActive}
              >
                <BlurView intensity={75} tint="light" style={styles.glassTileBlur}>
                  <View style={styles.tileContent}>
                    <View style={[styles.tileIconCircle, { backgroundColor: 'rgba(255, 255, 255, 0.22)' }]}>
                      {pcSyncActive ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Laptop size={20} color="#FFFFFF" strokeWidth={2.2} />
                      )}
                    </View>
                    <View style={styles.tileTextCol}>
                      <View style={styles.badgeRow}>
                        <Text style={styles.tileTitle}>Sign in via Computer</Text>
                        <View style={styles.recBadge}>
                          <Text style={styles.recBadgeText}>FASTEST</Text>
                        </View>
                      </View>
                      <Text style={styles.tileSub}>
                        {pcSyncActive ? pcSyncMessage : 'Opens Google on PC • Instant 1-tap phone sync'}
                      </Text>
                    </View>
                    {!pcSyncActive && <ArrowRight size={18} color="rgba(255, 255, 255, 0.85)" />}
                  </View>
                </BlurView>
              </Pressable>

              {/* YouTube Music Mobile Browser Connect */}
              <Pressable
                style={({ pressed }) => [
                  styles.glassTile,
                  pressed && styles.buttonPressed
                ]}
                onPress={handleYouTubeLogin}
                disabled={loadingPlatform !== null}
              >
                <BlurView intensity={70} tint="light" style={styles.glassTileBlur}>
                  <View style={styles.tileContent}>
                    <View style={[styles.tileIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.20)' }]}>
                      <Radio size={20} color="#EF4444" strokeWidth={2.2} />
                    </View>
                    <View style={styles.tileTextCol}>
                      <Text style={styles.tileTitle}>Connect on Phone (Browser)</Text>
                      <Text style={styles.tileSub}>Google OAuth in phone browser</Text>
                    </View>
                    {loadingPlatform === 'google' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <ArrowRight size={18} color="rgba(255, 255, 255, 0.7)" />
                    )}
                  </View>
                </BlurView>
              </Pressable>

              {/* Spotify Native Connect */}
              <Pressable
                style={({ pressed }) => [
                  styles.glassTile,
                  pressed && styles.buttonPressed
                ]}
                onPress={handleSpotifyLogin}
                disabled={loadingPlatform !== null}
              >
                <BlurView intensity={70} tint="light" style={styles.glassTileBlur}>
                  <View style={styles.tileContent}>
                    <View style={[styles.tileIconCircle, { backgroundColor: 'rgba(29, 185, 84, 0.20)' }]}>
                      <Music2 size={20} color="#1DB954" strokeWidth={2.2} />
                    </View>
                    <View style={styles.tileTextCol}>
                      <Text style={styles.tileTitle}>Connect with Spotify</Text>
                      <Text style={styles.tileSub}>Sync playlists and saved tracks</Text>
                    </View>
                    {loadingPlatform === 'spotify' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <ArrowRight size={18} color="rgba(255, 255, 255, 0.7)" />
                    )}
                  </View>
                </BlurView>
              </Pressable>

              {/* Rescue Tool for "127.0.0.1 Refused to Connect" */}
              <View style={styles.rescueContainer}>
                <Pressable
                  style={styles.rescueHeaderBtn}
                  onPress={() => setShowRescueInput(!showRescueInput)}
                >
                  <HelpCircle size={14} color="rgba(255, 255, 255, 0.7)" />
                  <Text style={styles.rescueHeaderText}>
                    {showRescueInput ? 'Hide 127.0.0.1 fix helper' : 'Stuck on "127.0.0.1 refused to connect"?'}
                  </Text>
                </Pressable>

                {showRescueInput && (
                  <BlurView intensity={70} tint="light" style={styles.rescueBox}>
                    <Text style={styles.rescueInstructions}>
                      Because Google redirects to your PC's localhost, copy the URL from your phone's browser address bar and paste it below:
                    </Text>

                    <Pressable
                      style={({ pressed }) => [
                        styles.pasteButton,
                        pressed && styles.buttonPressed
                      ]}
                      onPress={handlePasteFromClipboard}
                      disabled={loadingPlatform === 'exchange'}
                    >
                      <ClipboardPaste size={15} color="#181716" style={{ marginRight: 6 }} />
                      <Text style={styles.pasteButtonText}>Paste from Clipboard & Log In</Text>
                    </Pressable>

                    <View style={styles.manualInputRow}>
                      <TextInput
                        style={styles.manualInput}
                        placeholder="Or paste code/URL manually..."
                        placeholderTextColor="rgba(255, 255, 255, 0.4)"
                        value={pastedUrl}
                        onChangeText={setPastedUrl}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      {pastedUrl.length > 0 && (
                        <Pressable
                          style={styles.submitCodeBtn}
                          onPress={() => executeCodeExchange(pastedUrl)}
                          disabled={loadingPlatform === 'exchange'}
                        >
                          <Text style={styles.submitCodeBtnText}>Go</Text>
                        </Pressable>
                      )}
                    </View>

                    {rescueError && (
                      <Text style={styles.rescueErrorText}>{rescueError}</Text>
                    )}

                    <Pressable
                      style={styles.checkPcBtn}
                      onPress={handleCheckActivePcSession}
                      disabled={loadingPlatform === 'check_pc'}
                    >
                      <RefreshCw size={12} color="rgba(255, 255, 255, 0.6)" style={{ marginRight: 5 }} />
                      <Text style={styles.checkPcBtnText}>
                        {loadingPlatform === 'check_pc' ? 'Checking PC...' : 'Check if already logged in on PC'}
                      </Text>
                    </Pressable>
                  </BlurView>
                )}
              </View>

              {/* Solid White Guest Pill (As seen in reference image) */}
              <Pressable
                style={({ pressed }) => [
                  styles.solidWhiteButton,
                  pressed && styles.buttonPressed
                ]}
                onPress={handleGuestEntry}
                disabled={loadingPlatform !== null}
              >
                {loadingPlatform === 'guest' ? (
                  <ActivityIndicator size="small" color="#181716" />
                ) : (
                  <>
                    <Sparkles size={16} color="#181716" style={{ marginRight: 8 }} />
                    <Text style={styles.solidWhiteButtonText}>Explore as Guest</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
        </View>

        {/* Footer Trust & Security Notice */}
        <View style={styles.footerSection}>
          <Lock size={12} color="rgba(255, 255, 255, 0.45)" />
          <Text style={styles.footerText}>
            Read-only library alignment • End-to-end token encryption
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E0C0B',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 56,
    paddingBottom: 36
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 22,
    zIndex: 10
  },
  closeBlur: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    overflow: 'hidden'
  },
  headerSection: {
    alignItems: 'center',
    marginTop: 16
  },
  logoBadgeContainer: {
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20
  },
  logoBadgeBlur: {
    width: 74,
    height: 74,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    overflow: 'hidden'
  },
  brandTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.6,
    marginBottom: 6
  },
  brandTagline: {
    fontSize: 12.5,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10
  },
  brandDescription: {
    fontSize: 13.5,
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
    maxWidth: 330
  },
  cardContainer: {
    width: '100%',
    marginVertical: 12
  },
  glassCardBlur: {
    borderRadius: 28,
    padding: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 28
  },
  optionsList: {
    gap: 12
  },
  glassTile: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16
  },
  glassTileBlur: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)'
  },
  tileContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  tileIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  tileTextCol: {
    flex: 1
  },
  tileTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2
  },
  tileSub: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.65)'
  },
  solidWhiteButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 9999,
    marginTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16
  },
  solidWhiteButtonText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#181716'
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }]
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.35)'
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.35)'
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  userInfo: {
    marginLeft: 14,
    flex: 1
  },
  sessionStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2
  },
  sessionStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.success,
    letterSpacing: 0.8,
    marginLeft: 4
  },
  userName: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  userId: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.55)',
    marginTop: 1
  },
  signOutButton: {
    alignItems: 'center',
    marginTop: 14
  },
  signOutText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.55)'
  },
  footerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
    marginBottom: 8
  },
  footerText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
    fontWeight: '500'
  },
  scrollContent: {
    paddingBottom: 40
  },
  pcSyncTile: {
    borderColor: 'rgba(255, 255, 255, 0.45)'
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2
  },
  recBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  recBadgeText: {
    color: '#0E0C0B',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  rescueContainer: {
    marginTop: 4
  },
  rescueHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8
  },
  rescueHeaderText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '600'
  },
  rescueBox: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    overflow: 'hidden',
    marginTop: 6
  },
  rescueInstructions: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
    lineHeight: 17,
    marginBottom: 12
  },
  pasteButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 9999,
    marginBottom: 10
  },
  pasteButtonText: {
    color: '#181716',
    fontSize: 13,
    fontWeight: '700'
  },
  manualInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  manualInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#FFFFFF',
    fontSize: 12.5
  },
  submitCodeBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)'
  },
  submitCodeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  rescueErrorText: {
    fontSize: 11.5,
    color: '#F87171',
    lineHeight: 16,
    marginBottom: 8
  },
  checkPcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8
  },
  checkPcBtnText: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.65)',
    fontWeight: '600'
  }
});

