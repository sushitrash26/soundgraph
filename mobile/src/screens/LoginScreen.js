import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Image,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  TextInput
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import {
  ChevronRight,
  GitFork,
  X,
  Lock,
  Laptop,
  ClipboardPaste,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Sparkles
} from 'lucide-react-native';
import { THEME } from '../theme/theme';
import { useMobileStore } from '../store/useMobileStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AmbientGlassBackground from '../components/AmbientGlassBackground';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ARTISTS = [
  {
    name: 'SZA',
    genre: 'Alternative R&B',
    image: 'https://images.unsplash.com/photo-1590506357340-4f2d8f5da5cd?auto=format&fit=crop&w=520&q=85'
  },
  {
    name: 'Frank Ocean',
    genre: 'Neo soul',
    image: 'https://images.unsplash.com/photo-1553291413-e5f0e2932694?auto=format&fit=crop&w=360&q=85'
  },
  {
    name: 'FKA twigs',
    genre: 'Art pop',
    image: 'https://images.unsplash.com/photo-1773592620747-b63734b81740?auto=format&fit=crop&w=360&q=85'
  }
];

// High-fidelity Spotify Mark
function SpotifyIcon({ size = 24, color = '#000000' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.58 14.43a.62.62 0 0 1-.85.2c-2.33-1.43-5.27-1.75-8.73-.96a.62.62 0 1 1-.28-1.2c3.8-.87 7.07-.5 9.66 1.08.3.18.4.57.2.88Zm1.22-2.7a.78.78 0 0 1-1.07.25c-2.67-1.64-6.74-2.11-9.9-1.16a.78.78 0 0 1-.45-1.49c3.61-1.09 8.1-.56 11.17 1.33.37.22.48.7.25 1.07Zm.1-2.81C14.7 9.02 9.4 8.85 6.35 9.77a.93.93 0 1 1-.54-1.78c3.5-1.06 9.37-.85 13.04 1.33a.93.93 0 0 1-.95 1.6Z" />
    </Svg>
  );
}

// High-fidelity YouTube Mark
function YouTubeIcon({ size = 24, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M21.58 7.19a2.76 2.76 0 0 0-1.94-1.95C17.93 4.78 12 4.78 12 4.78s-5.93 0-7.64.46a2.76 2.76 0 0 0-1.94 1.95A28.7 28.7 0 0 0 1.96 12c0 1.63.16 3.25.46 4.81a2.76 2.76 0 0 0 1.94 1.95c1.71.46 7.64.46 7.64.46s5.93 0 7.64-.46a2.76 2.76 0 0 0 1.94-1.95c.3-1.56.46-3.18.46-4.81s-.16-3.25-.46-4.81ZM10 15.1V8.9l5.2 3.1-5.2 3.1Z" />
    </Svg>
  );
}

export default function LoginScreen({ onClose }) {
  const insets = useSafeAreaInsets();
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showRescueInput, setShowRescueInput] = useState(false);
  const [pastedUrl, setPastedUrl] = useState('');
  const [rescueError, setRescueError] = useState(null);
  const [pcSyncActive, setPcSyncActive] = useState(false);
  const [pcSyncMessage, setPcSyncMessage] = useState('');

  // -------------------------------------------------------------
  // REANIMATED 3D DECK PHYSICS (Faithful to Figma @keyframes)
  // -------------------------------------------------------------
  // 1. Left Card: cover-left 6s ease-in-out infinite
  const leftX = useSharedValue(-82);
  const leftY = useSharedValue(6);
  const leftRotY = useSharedValue(22);
  const leftRotZ = useSharedValue(-9);
  const leftScale = useSharedValue(0.84);

  // 2. Center Card: cover-center 5s ease-in-out infinite
  const centerY = useSharedValue(0);
  const centerScale = useSharedValue(1);

  // 3. Right Card: cover-right 6.5s ease-in-out infinite
  const rightX = useSharedValue(82);
  const rightY = useSharedValue(6);
  const rightRotY = useSharedValue(-22);
  const rightRotZ = useSharedValue(9);
  const rightScale = useSharedValue(0.84);

  // 4. Orbit Satellite pulse
  const orbitPulse = useSharedValue(0.55);

  useEffect(() => {
    // Left card float
    leftX.value = withRepeat(
      withSequence(
        withTiming(-88, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-82, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    leftY.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(6, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    leftRotY.value = withRepeat(
      withSequence(
        withTiming(18, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(22, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    leftRotZ.value = withRepeat(
      withSequence(
        withTiming(-7, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-9, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    leftScale.value = withRepeat(
      withSequence(
        withTiming(0.86, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.84, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Center card breathe
    centerY.value = withRepeat(
      withSequence(
        withTiming(-9, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    centerScale.value = withRepeat(
      withSequence(
        withTiming(1.025, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Right card float
    rightX.value = withRepeat(
      withSequence(
        withTiming(88, { duration: 3250, easing: Easing.inOut(Easing.ease) }),
        withTiming(82, { duration: 3250, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    rightY.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 3250, easing: Easing.inOut(Easing.ease) }),
        withTiming(6, { duration: 3250, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    rightRotY.value = withRepeat(
      withSequence(
        withTiming(-18, { duration: 3250, easing: Easing.inOut(Easing.ease) }),
        withTiming(-22, { duration: 3250, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    rightRotZ.value = withRepeat(
      withSequence(
        withTiming(7, { duration: 3250, easing: Easing.inOut(Easing.ease) }),
        withTiming(9, { duration: 3250, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    rightScale.value = withRepeat(
      withSequence(
        withTiming(0.86, { duration: 3250, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.84, { duration: 3250, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Orbit pulse
    orbitPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.45, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedLeftCardStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { translateX: leftX.value },
      { translateY: leftY.value },
      { rotateY: `${leftRotY.value}deg` },
      { rotateZ: `${leftRotZ.value}deg` },
      { scale: leftScale.value }
    ]
  }));

  const animatedCenterCardStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { translateY: centerY.value },
      { scale: centerScale.value }
    ]
  }));

  const animatedRightCardStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { translateX: rightX.value },
      { translateY: rightY.value },
      { rotateY: `${rightRotY.value}deg` },
      { rotateZ: `${rightRotZ.value}deg` },
      { scale: rightScale.value }
    ]
  }));

  const animatedOrbitStyle = useAnimatedStyle(() => ({
    opacity: orbitPulse.value
  }));

  // -------------------------------------------------------------
  // AUTHENTICATION LOGIC
  // -------------------------------------------------------------
  const handleSpotifyConnect = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoadingPlatform('spotify');
    try {
      await loginWithSpotify();
      if (onClose) onClose();
    } finally {
      setLoadingPlatform(null);
    }
  };

  const handleYouTubeConnect = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoadingPlatform('google');
    try {
      await loginWithGoogle();
      if (onClose) onClose();
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
          setPcSyncMessage('Waiting for login on PC... Click your account on computer!');
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
    if (onClose) onClose();
  };

  const handleContinueExisting = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (onClose) onClose();
    setOnboardingStep('quiz');
  };

  return (
    <View style={styles.container}>
      {/* Dynamic Ambient Glass Background with Glow Orbs */}
      <AmbientGlassBackground />

      {/* Subtle Concentric Rings Watermark at Upper Screen */}
      <View style={styles.concentricWatermark} pointerEvents="none">
        <View style={[styles.watermarkRing, { width: 380, height: 380 }]} />
        <View style={[styles.watermarkRing, { width: 520, height: 520 }]} />
        <View style={[styles.watermarkRing, { width: 660, height: 660 }]} />
      </View>

      {/* Dismiss Button if opened as modal */}
      {onClose && (
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <BlurView intensity={70} tint="dark" style={styles.closeBlur}>
            <X size={18} color="#FFFFFF" />
          </BlurView>
        </Pressable>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 6, 20),
            paddingBottom: Math.max(insets.bottom + 20, 36)
          }
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ======================================================== */}
        {/* 1. TOP HEADER (Brand Mark + Capsule Pill)                */}
        {/* ======================================================== */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <LinearGradient
              colors={['#E8FF9F', '#AADD37']}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={styles.brandMark}
            >
              <GitFork size={18} color="#0E0C0B" strokeWidth={2.4} />
            </LinearGradient>
            <Text style={styles.brandName}>Soundport</Text>
          </View>

          <BlurView intensity={65} tint="dark" style={styles.glassControl}>
            <Text style={styles.glassControlText}>YOUR MUSIC, ANYWHERE</Text>
          </BlurView>
        </View>

        {/* ======================================================== */}
        {/* 2. HERO 3D PERSPECTIVE CARD DECK                         */}
        {/* ======================================================== */}
        <View style={styles.visualSection}>
          <View style={styles.deckContainer}>
            {/* Pulsing Music Orbit 1 */}
            <Animated.View style={[styles.musicOrbitOne, animatedOrbitStyle]}>
              <View style={styles.satelliteDotOne} />
            </Animated.View>

            {/* Pulsing Music Orbit 2 */}
            <Animated.View style={[styles.musicOrbitTwo, animatedOrbitStyle]}>
              <View style={styles.satelliteDotTwo} />
            </Animated.View>

            {/* Card Left: Frank Ocean */}
            <Animated.View style={[styles.cardCommon, styles.cardSide, animatedLeftCardStyle]}>
              <Image
                source={{ uri: ARTISTS[1].image }}
                style={styles.cardImage}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['rgba(255,255,255,0.3)', 'transparent', 'rgba(0,0,0,0.45)']}
                style={StyleSheet.absoluteFillObject}
              />
            </Animated.View>

            {/* Card Center: SZA with Glass Overlay Pill */}
            <Animated.View style={[styles.cardCommon, styles.cardCenter, animatedCenterCardStyle]}>
              <Image
                source={{ uri: ARTISTS[0].image }}
                style={styles.cardImage}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['rgba(255,255,255,0.35)', 'transparent', 'rgba(0,0,0,0.6)']}
                style={StyleSheet.absoluteFillObject}
              />
              {/* Frosted Soundport Center Tag */}
              <View style={styles.centerCardPillWrapper}>
                <BlurView intensity={90} tint="dark" style={styles.centerCardPill}>
                  <Text style={styles.centerCardPillText}>Your sound, in one place</Text>
                </BlurView>
              </View>
            </Animated.View>

            {/* Card Right: FKA twigs */}
            <Animated.View style={[styles.cardCommon, styles.cardSide, animatedRightCardStyle]}>
              <Image
                source={{ uri: ARTISTS[2].image }}
                style={styles.cardImage}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['rgba(255,255,255,0.3)', 'transparent', 'rgba(0,0,0,0.45)']}
                style={StyleSheet.absoluteFillObject}
              />
            </Animated.View>
          </View>

          {/* ======================================================== */}
          {/* 3. EDITORIAL HERO HEADLINE & VALUE PROP                   */}
          {/* ======================================================== */}
          <View style={styles.heroCopyBlock}>
            <Text style={styles.eyebrow}>ONE PROFILE. EVERY PLATFORM.</Text>
            <Text style={styles.mainTitle}>
              {'Your music has\nno borders.'}
            </Text>
            <Text style={styles.subtitle}>
              Connect a music account to discover your taste, get better recommendations, and move playlists freely.
            </Text>
          </View>
        </View>

        {/* ======================================================== */}
        {/* 4. SMOKED ACRYLIC LOGIN GLASS CARD                        */}
        {/* ======================================================== */}
        {isAuthenticated && user ? (
          // Active Authenticated State
          <BlurView intensity={80} tint="dark" style={styles.glassAuthCard}>
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
                  <ShieldCheck size={13} color="#D7FF64" />
                  <Text style={styles.sessionStatusText}>ACTIVE SESSION</Text>
                </View>
                <Text style={styles.userName} numberOfLines={1}>{user.name || 'Sonic Explorer'}</Text>
                <Text style={styles.userId} numberOfLines={1}>{user.id}</Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.solidWhiteButton,
                pressed && styles.buttonPressed
              ]}
              onPress={handleContinueExisting}
            >
              <Text style={styles.solidWhiteButtonText}>Continue to Vibe Setup</Text>
              <ArrowRight size={16} color="#11120E" />
            </Pressable>

            <Pressable style={styles.signOutButton} onPress={logoutUser}>
              <Text style={styles.signOutText}>Sign out from this session</Text>
            </Pressable>
          </BlurView>
        ) : (
          // Unauthenticated: Dual Connect Rows (Spotify & YouTube)
          <BlurView intensity={85} tint="dark" style={styles.glassAuthCard}>
            {/* Spotify Connect Button */}
            <Pressable
              style={({ pressed }) => [
                styles.connectButton,
                pressed && styles.buttonPressed,
                loadingPlatform === 'spotify' && styles.buttonLoading
              ]}
              onPress={handleSpotifyConnect}
              disabled={loadingPlatform !== null}
            >
              <View style={styles.spotifyMark}>
                <SpotifyIcon size={22} color="#0E0C0B" />
              </View>

              <View style={styles.connectTextCol}>
                <Text style={styles.connectTitle}>
                  {loadingPlatform === 'spotify' ? 'Connecting...' : 'Continue with Spotify'}
                </Text>
                <Text style={styles.connectSubtitle}>Sign in or create an account</Text>
              </View>

              <View style={styles.connectArrowCircle}>
                {loadingPlatform === 'spotify' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ChevronRight size={17} color="rgba(255, 255, 255, 0.7)" />
                )}
              </View>
            </Pressable>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* YouTube Connect Button */}
            <Pressable
              style={({ pressed }) => [
                styles.connectButton,
                pressed && styles.buttonPressed,
                loadingPlatform === 'google' && styles.buttonLoading
              ]}
              onPress={handleYouTubeConnect}
              disabled={loadingPlatform !== null}
            >
              <View style={styles.youtubeMark}>
                <YouTubeIcon size={22} color="#FFFFFF" />
              </View>

              <View style={styles.connectTextCol}>
                <Text style={styles.connectTitle}>
                  {loadingPlatform === 'google' ? 'Connecting...' : 'Continue with YouTube'}
                </Text>
                <Text style={styles.connectSubtitle}>Sign in or create an account</Text>
              </View>

              <View style={styles.connectArrowCircle}>
                {loadingPlatform === 'google' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ChevronRight size={17} color="rgba(255, 255, 255, 0.7)" />
                )}
              </View>
            </Pressable>
          </BlurView>
        )}

        {/* ======================================================== */}
        {/* 5. PRIVACY FOOTER                                         */}
        {/* ======================================================== */}
        <View style={styles.privacyFooter}>
          <Lock size={12} color="rgba(255, 255, 255, 0.35)" />
          <Text style={styles.privacyText}>We only access the music data you approve.</Text>
        </View>

        {/* ======================================================== */}
        {/* 6. ADVANCED / DEVELOPER TESTING DRAWER (Collapsible)     */}
        {/* ======================================================== */}
        {!isAuthenticated && (
          <View style={styles.devDrawerContainer}>
            <Pressable
              style={styles.devToggleBtn}
              onPress={() => setShowAdvanced(!showAdvanced)}
            >
              <Text style={styles.devToggleText}>
                {showAdvanced ? 'Hide connection options ▲' : 'Trouble connecting? Testing options ▼'}
              </Text>
            </Pressable>

            {showAdvanced && (
              <BlurView intensity={70} tint="dark" style={styles.devDrawerCard}>
                {/* Option 1: Guest Entry */}
                <Pressable
                  style={({ pressed }) => [styles.devOptionTile, pressed && styles.buttonPressed]}
                  onPress={handleGuestEntry}
                >
                  <Sparkles size={16} color="#D7FF64" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.devOptionTitle}>Explore as Guest</Text>
                    <Text style={styles.devOptionSub}>Instant access to taste quiz & recommendations</Text>
                  </View>
                </Pressable>

                {/* Option 2: Sign in via PC */}
                <Pressable
                  style={({ pressed }) => [styles.devOptionTile, pressed && styles.buttonPressed]}
                  onPress={handlePcSync}
                >
                  <Laptop size={16} color="#FA7185" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.devOptionTitle}>Sign in via PC (Sync Session)</Text>
                    <Text style={styles.devOptionSub}>Bypasses Google loopback on local USB</Text>
                  </View>
                </Pressable>

                {/* Option 3: Paste callback */}
                <Pressable
                  style={({ pressed }) => [styles.devOptionTile, pressed && styles.buttonPressed]}
                  onPress={handlePasteFromClipboard}
                >
                  <ClipboardPaste size={16} color="#8B5CF6" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.devOptionTitle}>Paste Callback URL from Clipboard</Text>
                    <Text style={styles.devOptionSub}>Exchange auth code directly</Text>
                  </View>
                </Pressable>

                {pcSyncActive && (
                  <View style={styles.syncStatusBox}>
                    <ActivityIndicator size="small" color="#D7FF64" />
                    <Text style={styles.syncStatusText}>{pcSyncMessage}</Text>
                    <Pressable style={styles.checkSyncBtn} onPress={handleCheckActivePcSession}>
                      <Text style={styles.checkSyncText}>Check Status</Text>
                    </Pressable>
                  </View>
                )}

                {rescueError && (
                  <Text style={styles.errorText}>{rescueError}</Text>
                )}
              </BlurView>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  concentricWatermark: {
    position: 'absolute',
    top: -120,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0
  },
  watermarkRing: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.038)'
  },
  closeBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 50
  },
  closeBlur: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    overflow: 'hidden'
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40,
    zIndex: 10
  },

  // 1. Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D7FF64',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4
  },
  brandName: {
    color: '#F4F3EE',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'DMSans_700Bold',
    letterSpacing: -0.3
  },
  glassControl: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden'
  },
  glassControlText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 9.5,
    fontWeight: '700',
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 1.4,
    textTransform: 'uppercase'
  },

  // 2. Visual Deck Section
  visualSection: {
    marginTop: 22,
    alignItems: 'center'
  },
  deckContainer: {
    width: '100%',
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  cardCommon: {
    position: 'absolute',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000000',
    shadowOpacity: 0.42,
    shadowRadius: 18,
    elevation: 8
  },
  cardImage: {
    width: '100%',
    height: '100%',
    position: 'absolute'
  },
  cardSide: {
    width: 122,
    height: 154,
    zIndex: 1
  },
  cardCenter: {
    width: 138,
    height: 174,
    zIndex: 3,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 12
  },
  centerCardPillWrapper: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8
  },
  centerCardPill: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    paddingVertical: 5,
    paddingHorizontal: 6,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.35)'
  },
  centerCardPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'DMSans_700Bold',
    textAlign: 'center'
  },

  // Orbit Rings
  musicOrbitOne: {
    position: 'absolute',
    width: 250,
    height: 110,
    borderRadius: 125,
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 100, 0.18)',
    transform: [{ rotate: '-8deg' }]
  },
  satelliteDotOne: {
    position: 'absolute',
    top: '50%',
    right: -4,
    marginTop: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D7FF64',
    shadowColor: '#D7FF64',
    shadowOpacity: 0.85,
    shadowRadius: 10,
    elevation: 4
  },
  musicOrbitTwo: {
    position: 'absolute',
    width: 200,
    height: 150,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.18)',
    transform: [{ rotate: '58deg' }]
  },
  satelliteDotTwo: {
    position: 'absolute',
    top: '50%',
    right: -4,
    marginTop: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#A879FF',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.85,
    shadowRadius: 10,
    elevation: 4
  },

  // Copy Block
  heroCopyBlock: {
    marginTop: 22,
    alignItems: 'center',
    paddingHorizontal: 8
  },
  eyebrow: {
    color: '#D7FF64',
    fontSize: 10.5,
    fontWeight: '700',
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center'
  },
  mainTitle: {
    color: '#F4F3EE',
    fontSize: 42,
    lineHeight: 42,
    fontWeight: '700',
    fontFamily: 'DMSans_700Bold',
    letterSpacing: -1.6,
    textAlign: 'center',
    marginTop: 10
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.52)',
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
    maxWidth: 320,
    marginTop: 14
  },

  // 4. Glass Auth Panel
  glassAuthCard: {
    marginTop: 28,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: 'rgba(22, 24, 20, 0.82)',
    padding: 12,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 10
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }]
  },
  buttonLoading: {
    opacity: 0.75
  },
  spotifyMark: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1ED760',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1ED760',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6
  },
  youtubeMark: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF0033',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF0033',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6
  },
  connectTextCol: {
    flex: 1
  },
  connectTitle: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
    fontFamily: 'DMSans_700Bold'
  },
  connectSubtitle: {
    color: 'rgba(255, 255, 255, 0.42)',
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    marginTop: 2
  },
  connectArrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center'
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    paddingHorizontal: 12,
    gap: 10
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)'
  },
  dividerText: {
    color: 'rgba(255, 255, 255, 0.28)',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 1.8,
    textTransform: 'uppercase'
  },

  // Privacy Footer
  privacyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18
  },
  privacyText: {
    color: 'rgba(255, 255, 255, 0.34)',
    fontSize: 11,
    fontFamily: 'DMSans_500Medium'
  },

  // Active Authenticated State
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 12
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'DMSans_700Bold'
  },
  userInfo: {
    flex: 1
  },
  sessionStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  sessionStatusText: {
    color: '#D7FF64',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 1
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'DMSans_700Bold',
    marginTop: 2
  },
  userId: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
    fontFamily: 'DMSans_400Regular'
  },
  solidWhiteButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 9999,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12
  },
  solidWhiteButtonText: {
    color: '#11120E',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'DMSans_700Bold'
  },
  signOutButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4
  },
  signOutText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
    fontFamily: 'DMSans_500Medium'
  },

  // 6. Advanced Drawer
  devDrawerContainer: {
    marginTop: 24,
    alignItems: 'center'
  },
  devToggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14
  },
  devToggleText: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'DMSans_500Medium'
  },
  devDrawerCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 10,
    marginTop: 8,
    overflow: 'hidden'
  },
  devOptionTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginBottom: 6
  },
  devOptionTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'DMSans_600SemiBold'
  },
  devOptionSub: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 10.5,
    fontFamily: 'DMSans_400Regular',
    marginTop: 2
  },
  syncStatusBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    marginTop: 6,
    alignItems: 'center',
    gap: 6
  },
  syncStatusText: {
    color: '#D7FF64',
    fontSize: 11,
    textAlign: 'center',
    fontFamily: 'DMSans_500Medium'
  },
  checkSyncBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999,
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
  },
  checkSyncText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'DMSans_600SemiBold'
  },
  errorText: {
    color: '#FA7185',
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
    fontFamily: 'DMSans_500Medium'
  }
});
