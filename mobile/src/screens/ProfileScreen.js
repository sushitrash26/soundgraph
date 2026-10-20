import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Dimensions,
  Modal
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
import {
  ArrowLeft,
  Share2,
  Sparkles,
  Headphones,
  GitFork,
  X,
  Copy,
  Check,
  RotateCcw,
  LogOut,
  Trophy,
  CheckCircle2,
  Music2
} from 'lucide-react-native';
import { THEME } from '../theme/theme';
import { useMobileStore } from '../store/useMobileStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AmbientGlassBackground from '../components/AmbientGlassBackground';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FEATURED_ARTISTS = [
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
  },
  {
    name: 'Tame Impala',
    genre: 'Psychedelic pop',
    image: 'https://images.unsplash.com/photo-1760800185627-12eb152aaca4?auto=format&fit=crop&w=360&q=85'
  }
];

export default function ProfileScreen({ onOpenAuth }) {
  const insets = useSafeAreaInsets();
  const {
    user,
    authStatus,
    onboardingMilestoneData,
    logoutUser,
    setOnboardingStep,
    setCurrentTab,
    youtubePlaylists,
    spotifyPlaylists,
    userProfileData,
    isLoadingProfile,
    fetchUserProfile
  } = useMobileStore();

  const [period, setPeriod] = useState('month'); // 'month' | 'year'
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  // Animations matching Figma index.css exactly:
  // 1. Shimmer sweep across hero acrylic glass card
  const shimmerTranslate = useSharedValue(-SCREEN_WIDTH);
  // 2. Featured badge floating up/down with subtle tilt
  const badgeFloat = useSharedValue(0);
  const badgeRotate = useSharedValue(0);
  // 3. Hero card gentle acrylic breathing
  const heroBreathe = useSharedValue(0);
  // 4. Spark badge pulsing scale on avatar
  const sparkScale = useSharedValue(1);
  // 5. Specular glint across the lime card
  const limeGlint = useSharedValue(-SCREEN_WIDTH);
  // 6. Ambient floating background orbs
  const orbFloat = useSharedValue(0);

  useEffect(() => {
    // Shimmer sweep: glass-sweep 5.5s infinite
    shimmerTranslate.value = withRepeat(
      withTiming(SCREEN_WIDTH * 1.8, {
        duration: 5500,
        easing: Easing.bezier(0.4, 0, 0.2, 1)
      }),
      -1,
      false
    );

    // Badge float: badge-float 4s infinite
    badgeFloat.value = withRepeat(
      withSequence(
        withTiming(-7, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    badgeRotate.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Hero breathe: hero-breathe 7s infinite
    heroBreathe.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 3500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 3500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Spark pulse: spark-pulse 2.8s infinite
    sparkScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 1400, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Lime glint: lime-glint 6s infinite
    limeGlint.value = withRepeat(
      withTiming(SCREEN_WIDTH * 1.5, {
        duration: 6000,
        easing: Easing.bezier(0.4, 0, 0.2, 1)
      }),
      -1,
      false
    );

    // Ambient orb floating
    orbFloat.value = withRepeat(
      withSequence(
        withTiming(18, { duration: 7000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-18, { duration: 7000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerTranslate.value }, { rotate: '18deg' }]
  }));

  const floatingBadgeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: badgeFloat.value },
      { rotate: `${badgeRotate.value}deg` }
    ]
  }));

  const heroBreatheStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: heroBreathe.value }]
  }));

  const sparkPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sparkScale.value }]
  }));

  const limeGlintStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: limeGlint.value }, { rotate: '22deg' }]
  }));

  const ambientOrbStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: orbFloat.value }]
  }));

  const profileUser = userProfileData?.user || user;
  const userName = profileUser?.name || 'Explorer';
  const userAvatar = profileUser?.avatar_url || FEATURED_ARTISTS[0].image;
  const connectedPlatforms = profileUser?.connected_platforms || (authStatus?.spotify_connected ? ['spotify'] : ['youtube']);
  const connectedCount = connectedPlatforms.length || 1;

  const archetype = userProfileData?.passport?.archetype || onboardingMilestoneData?.archetype || 'Midnight Explorer';
  const tagline = userProfileData?.passport?.tagline || 'Dreamy vocals, late-night R&B and a little beautiful chaos.';

  const topArtists = userProfileData?.top_artists && userProfileData.top_artists.length >= 2
    ? userProfileData.top_artists
    : FEATURED_ARTISTS;

  const signature = userProfileData?.signature;
  const activePeriodSignature = signature ? signature[period] : null;
  const discoveryScore = activePeriodSignature ? activePeriodSignature.discovery_score : (period === 'month' ? 82 : 76);
  const discoveryTag = activePeriodSignature ? activePeriodSignature.tag : 'Explorer';

  const sliders = activePeriodSignature?.sliders || [
    { start: 'Familiar', end: 'Adventurous', value: period === 'month' ? 82 : 76 },
    { start: 'Calm', end: 'Energetic', value: period === 'month' ? 64 : 58 },
    { start: 'Focused', end: 'Eclectic', value: period === 'month' ? 73 : 69 }
  ];

  const migration = userProfileData?.migration;
  const tracksMoved = migration ? migration.tracks_moved : 0;
  const hoursPreserved = migration ? migration.hours_preserved : '0 hrs';
  const perfectTransfers = migration ? migration.perfect_transfers : 0;
  const hasMigrated = migration ? migration.has_migrated : false;

  const featuredBadge = userProfileData?.featured_badge || {
    title: 'Bridge Builder',
    rarity_tag: 'TOP 8% RARE',
    description: 'Moved over 1,000 tracks between worlds.',
    icon: 'route'
  };

  const handleCopyLink = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const shareUrl = userProfileData?.passport?.share_url || `https://soundgraph.app/passport/${user?.id || 'explorer'}`;
      await Clipboard.setStringAsync(shareUrl);
    } catch {
      // fallback
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRecalibrate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setOnboardingStep('quiz');
  };

  const handleSignOut = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await logoutUser();
  };

  // Dimensions for exact CSS grid-cols-[1.55fr_1fr_1fr]
  const AVAILABLE_WIDTH = SCREEN_WIDTH - 40;
  const GAP = 8;
  const UNIT_WIDTH = Math.floor((AVAILABLE_WIDTH - 2 * GAP) / 3.55);
  const COL1_WIDTH = Math.floor(UNIT_WIDTH * 1.55);
  const SQUARE_SIZE = UNIT_WIDTH;
  const TALL_HEIGHT = SQUARE_SIZE * 2 + GAP;

  return (
    <View style={styles.container}>
      <AmbientGlassBackground />

      {/* Subtle Ethereal Ambient Background Orbs */}
      <Animated.View style={[styles.ambientOrbPurple, ambientOrbStyle]} pointerEvents="none" />
      <Animated.View style={[styles.ambientOrbLime, ambientOrbStyle]} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 6, 16),
            paddingBottom: Math.max(insets.bottom + 90, 110)
          }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Editorial Header Bar (Directly from Figma) */}
        <View style={styles.topHeader}>
          <Pressable
            style={styles.glassControlBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setCurrentTab('recommendations');
            }}
          >
            <BlurView intensity={70} tint="dark" style={styles.glassControlBlur}>
              <ArrowLeft size={18} color="#FFFFFF" />
            </BlurView>
          </Pressable>

          <Text style={styles.headerTitle}>YOUR PROFILE</Text>

          <Pressable
            style={styles.shareHeaderBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShareOpen(true);
            }}
          >
            <Share2 size={18} color="#0E0D0C" />
          </Pressable>
        </View>

        {/* Section 1: Hero Music Passport Card */}
        <View style={styles.heroSection}>
          <Animated.View style={heroBreatheStyle}>
            <BlurView intensity={85} tint="dark" style={styles.heroGlassPanel}>
              {/* Dynamic internal aurora gradients matching Figma preview */}
              <View style={styles.auroraGlow} pointerEvents="none">
                <LinearGradient
                  colors={['rgba(139, 92, 246, 0.45)', 'rgba(250, 113, 133, 0.35)', 'rgba(215, 255, 100, 0.35)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
              </View>

              {/* Specular Shimmer Sweep Overlay */}
              <Animated.View style={[styles.shimmerBar, shimmerStyle]} pointerEvents="none">
                <LinearGradient
                  colors={[
                    'rgba(255, 255, 255, 0)',
                    'rgba(255, 255, 255, 0.22)',
                    'rgba(255, 255, 255, 0)'
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
              </Animated.View>

              {/* Top Row: User Avatar with Spark Badge & "Updated Today" Pill */}
              <View style={styles.heroTopRow}>
                <View style={styles.avatarWrapper}>
                  <Image
                    source={{ uri: userAvatar }}
                    style={styles.avatarImg}
                  />
                  <Animated.View style={[styles.avatarSparkBadge, sparkPulseStyle]}>
                    <Sparkles size={14} color="#11120E" fill="#11120E" />
                  </Animated.View>
                </View>

                <View style={styles.updatedPill}>
                  <BlurView intensity={70} tint="dark" style={styles.updatedPillBlur}>
                    <Text style={styles.updatedPillText}>UPDATED TODAY</Text>
                  </BlurView>
                </View>
              </View>

              {/* Middle Content: Name, Two-Line Bold Title & Tagline */}
              <View style={styles.heroMidContent}>
                <Text style={styles.passportOwnerText}>{userName}’s music passport</Text>
                <Text style={styles.heroArchetypeTitle}>
                  {archetype.includes(' ') ? archetype.replace(' ', '\n') : archetype}
                </Text>
                <Text style={styles.heroTagline}>
                  {tagline}
                </Text>
              </View>

              {/* Bottom Row: Connected Platforms & "View passport" CTA */}
              <View style={styles.heroBottomRow}>
                <View style={styles.platformsRow}>
                  {connectedPlatforms.includes('spotify') && (
                    <View style={[styles.platformIconDot, { backgroundColor: '#1ED760' }]}>
                      <Text style={styles.platformDotLetter}>S</Text>
                    </View>
                  )}
                  {connectedPlatforms.includes('youtube') && (
                    <View style={[styles.platformIconDot, { backgroundColor: '#FF0033' }]}>
                      <Text style={styles.platformDotLetter}>▶</Text>
                    </View>
                  )}
                  <Text style={styles.platformsConnectedText}>
                    {connectedCount} platform{connectedCount === 1 ? '' : 's'} connected
                  </Text>
                </View>

                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShareOpen(true);
                  }}
                >
                  <Text style={styles.viewPassportLink}>View passport</Text>
                </Pressable>
              </View>
            </BlurView>
          </Animated.View>
        </View>

        {/* Section 2: "On repeat" / "Your artists" Asymmetric Mosaic */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.eyebrow}>ON REPEAT</Text>
              <Text style={styles.sectionTitle}>Your artists</Text>
            </View>
            <Pressable>
              <Text style={styles.seeAllText}>See all</Text>
            </Pressable>
          </View>

          {/* Exact CSS grid-cols-[1.55fr_1fr_1fr] Geometry */}
          <View style={{ flexDirection: 'row', gap: GAP }}>
            {/* Col 1: Card 01 (tall card, spanning 2 rows) */}
            <View
              style={[
                styles.artistHeroCard,
                { width: COL1_WIDTH, height: TALL_HEIGHT }
              ]}
            >
              <Image
                source={{ uri: topArtists[0]?.image || FEATURED_ARTISTS[0].image }}
                style={styles.cardCoverImg}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.92)']}
                style={StyleSheet.absoluteFillObject}
              />
              <Text style={styles.artistRankHero}>01</Text>
              <View style={styles.artistHeroMeta}>
                <Text style={styles.artistHeroName} numberOfLines={1}>{topArtists[0]?.name || 'Artist'}</Text>
                <Text style={styles.artistHeroGenre} numberOfLines={1}>{topArtists[0]?.genre || 'Contemporary'}</Text>
              </View>
            </View>

            {/* Col 2 & Col 3 Container */}
            <View style={{ flex: 1, gap: GAP }}>
              {/* Row 1: Cards 02 & 03 */}
              <View style={{ flexDirection: 'row', gap: GAP }}>
                {topArtists.slice(1, 3).map((artist, idx) => (
                  <View
                    key={artist.name || idx}
                    style={[
                      styles.artistSquareCard,
                      { width: SQUARE_SIZE, height: SQUARE_SIZE }
                    ]}
                  >
                    <Image
                      source={{ uri: artist.image || FEATURED_ARTISTS[idx + 1].image }}
                      style={styles.cardCoverImg}
                      resizeMode="cover"
                    />
                    <LinearGradient
                      colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.85)']}
                      style={StyleSheet.absoluteFillObject}
                    />
                    <Text style={styles.artistRankSquare}>0{idx + 2}</Text>
                    <Text style={styles.artistSquareName} numberOfLines={1}>
                      {artist.name}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Row 2: Card 04 */}
              <View style={{ flexDirection: 'row', gap: GAP }}>
                <View
                  style={[
                    styles.artistSquareCard,
                    { width: SQUARE_SIZE, height: SQUARE_SIZE }
                  ]}
                >
                  <Image
                    source={{ uri: topArtists[3]?.image || topArtists[0]?.image || FEATURED_ARTISTS[3].image }}
                    style={styles.cardCoverImg}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.85)']}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <Text style={styles.artistRankSquare}>04</Text>
                  <Text style={styles.artistSquareName} numberOfLines={1}>
                    {topArtists[3]?.name || topArtists[0]?.name || 'Artist'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.mosaicFootnote}>Verified artist portraits cached from Deezer & graph</Text>
        </View>

        {/* Section 3: "Your pulse" / "Music signature" */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.eyebrow}>YOUR PULSE</Text>
              <Text style={styles.sectionTitle}>Music signature</Text>
            </View>
            {/* Period Toggle Pill */}
            <View style={styles.periodToggleWrapper}>
              <Pressable
                style={[
                  styles.periodToggleBtn,
                  period === 'month' && styles.periodToggleBtnActive
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPeriod('month');
                }}
              >
                <Text
                  style={[
                    styles.periodToggleText,
                    period === 'month' && styles.periodToggleTextActive
                  ]}
                >
                  Month
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.periodToggleBtn,
                  period === 'year' && styles.periodToggleBtnActive
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPeriod('year');
                }}
              >
                <Text
                  style={[
                    styles.periodToggleText,
                    period === 'year' && styles.periodToggleTextActive
                  ]}
                >
                  Year
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Music Signature Glass Panel */}
          <BlurView intensity={80} tint="dark" style={styles.pulseGlassCard}>
            <View style={styles.pulseTopRow}>
              <View>
                <Text style={styles.discoveryLabel}>Discovery score</Text>
                <View style={styles.discoveryScoreRow}>
                  <Text style={styles.discoveryScoreVal}>
                    {discoveryScore}
                  </Text>
                  <Text style={styles.discoveryScorePercent}>%</Text>
                </View>
              </View>

              <View style={styles.explorerTag}>
                <Text style={styles.explorerTagText}>{discoveryTag}</Text>
              </View>
            </View>

            {/* Gradient Spectrum Sliders */}
            <View style={styles.spectrumSlidersContainer}>
              {sliders.map((spec) => (
                <View key={spec.start} style={styles.spectrumRow}>
                  <View style={styles.spectrumLabels}>
                    <Text style={styles.spectrumEndText}>{spec.start}</Text>
                    <Text style={styles.spectrumEndText}>{spec.end}</Text>
                  </View>
                  <View style={styles.spectrumTrack}>
                    <LinearGradient
                      colors={['#8B5CF6', '#FA7185', '#D7FF64']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.spectrumFill, { width: `${spec.value}%` }]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </BlurView>
        </View>

        {/* Section 4: "Across the universe" / "Your migration story" */}
        <View style={styles.sectionContainer}>
          <Text style={styles.eyebrow}>ACROSS THE UNIVERSE</Text>
          <Text style={styles.sectionTitle}>Your migration story</Text>

          <View style={styles.migrationGrid}>
            {/* Top Large Lime Glass Card */}
            <View style={styles.limeGlassCard}>
              <Animated.View style={[styles.limeGlintBar, limeGlintStyle]} pointerEvents="none">
                <LinearGradient
                  colors={[
                    'rgba(255, 255, 255, 0)',
                    'rgba(255, 255, 255, 0.45)',
                    'rgba(255, 255, 255, 0)'
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
              </Animated.View>
              <View style={styles.limeContentCol}>
                <Text style={styles.limeCardTag}>TRACKS MOVED</Text>
                <Text style={styles.limeCardCount}>{tracksMoved.toLocaleString()}</Text>
                {!hasMigrated && (
                  <Pressable
                    style={styles.migrateCtaBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setCurrentTab('migration');
                    }}
                  >
                    <Text style={styles.migrateCtaText}>Migrate your first playlist ➔</Text>
                  </Pressable>
                )}
              </View>
              <View style={styles.limeIconCircle}>
                <GitFork size={28} color="#11120E" strokeWidth={2.2} />
              </View>
            </View>

            {/* Bottom 2 Side-by-Side Glass Cards */}
            <View style={styles.migrationRowCards}>
              {/* Left: Music Preserved */}
              <BlurView intensity={75} tint="dark" style={styles.migrationSubCard}>
                <Headphones size={22} color="#FA7185" style={{ marginBottom: 20 }} />
                <Text style={styles.migrationSubCount}>{hoursPreserved}</Text>
                <Text style={styles.migrationSubDesc}>Music preserved</Text>
              </BlurView>

              {/* Right: Perfect Transfers */}
              <BlurView intensity={75} tint="dark" style={styles.migrationSubCard}>
                <RotateCcw size={22} color="#8B5CF6" style={{ marginBottom: 20 }} />
                <Text style={styles.migrationSubCount}>{perfectTransfers}</Text>
                <Text style={styles.migrationSubDesc}>Perfect transfers</Text>
              </BlurView>
            </View>
          </View>
        </View>

        {/* Section 5: "Rare find" / "Featured badge" */}
        <View style={styles.sectionContainer}>
          <Text style={styles.eyebrow}>RARE FIND</Text>
          <Text style={styles.sectionTitle}>Featured badge</Text>

          <BlurView intensity={80} tint="dark" style={styles.badgeGlassCard}>
            <Animated.View style={floatingBadgeStyle}>
              <LinearGradient
                colors={['#D7FF64', '#FA7185', '#8B5CF6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.floatingBadgeSquare}
              >
                <Trophy size={34} color="#11120E" strokeWidth={2.4} />
              </LinearGradient>
            </Animated.View>

            <View style={styles.badgeMetaCol}>
              <Text style={styles.badgeRareTag}>{featuredBadge.rarity_tag}</Text>
              <Text style={styles.badgeTitle}>{featuredBadge.title}</Text>
              <Text style={styles.badgeSubtitle}>
                {featuredBadge.description}
              </Text>
            </View>
          </BlurView>
        </View>

        {/* Section 6: Full Width Share CTA Pill */}
        <Pressable
          style={styles.fullShareCtaBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShareOpen(true);
          }}
        >
          <Text style={styles.fullShareCtaText}>Share your music passport</Text>
          <View style={styles.fullShareIconCircle}>
            <Share2 size={16} color="#FFFFFF" />
          </View>
        </Pressable>

        {/* Section 7: Account Settings & Sign Out */}
        <View style={styles.accountSettingsSection}>
          <Pressable style={styles.recalibrateBtn} onPress={handleRecalibrate}>
            <RotateCcw size={15} color="#FFFFFF" />
            <Text style={styles.recalibrateText}>Recalibrate 10-Second Vibe</Text>
          </Pressable>

          <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
            <LogOut size={15} color="#EF4444" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ShareSheet Modal (Music Passport Sheet) */}
      <Modal
        visible={shareOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setShareOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShareOpen(false)}
          />

          <BlurView intensity={90} tint="dark" style={styles.passportSheetCard}>
            {/* The Vivid Passport Graphic Card */}
            <View style={styles.passportGraphic}>
              {/* Background Glows */}
              <View style={styles.passportOrbPurple} />
              <View style={styles.passportOrbCoral} />

              <View style={styles.passportGraphicInner}>
                <View style={styles.passportGraphicTopRow}>
                  <Text style={styles.passportCardEyebrow}>MUSIC PASSPORT</Text>
                  <View style={styles.passportYearPill}>
                    <Text style={styles.passportYearText}>2025</Text>
                  </View>
                </View>

                <Text style={styles.passportSoundIsText}>{userName}’s sound is</Text>
                <Text style={styles.passportLargeHeadline}>A {archetype.toLowerCase()}.</Text>

                <View style={styles.passportGraphicBottomDivider}>
                  <Text style={styles.passportArtistsList}>
                    {topArtists.slice(0, 3).map((a) => a.name).join(' · ')}
                  </Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.passportMadeWithTag}>MADE WITH</Text>
                    <Text style={styles.passportBrandTag}>SOUNDGRAPH</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Modal Bottom Action Buttons */}
            <View style={styles.passportActionRow}>
              <Pressable
                style={styles.copyLinkBtn}
                onPress={handleCopyLink}
              >
                {copied ? (
                  <>
                    <Check size={16} color="#11120E" style={{ marginRight: 6 }} />
                    <Text style={styles.copyLinkText}>Link Copied!</Text>
                  </>
                ) : (
                  <>
                    <Copy size={16} color="#11120E" style={{ marginRight: 6 }} />
                    <Text style={styles.copyLinkText}>Copy Profile Link</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                style={styles.closeModalBtn}
                onPress={() => setShareOpen(false)}
              >
                <X size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </BlurView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 110
  },

  // Ethereal Ambient Glow Orbs
  ambientOrbPurple: {
    position: 'absolute',
    top: 40,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(139, 92, 246, 0.16)',
    filter: 'blur(60px)'
  },
  ambientOrbLime: {
    position: 'absolute',
    top: 360,
    left: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(215, 255, 100, 0.12)',
    filter: 'blur(55px)'
  },

  // Top Header Bar
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 16
  },
  glassControlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)'
  },
  glassControlBlur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)'
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.45)',
    letterSpacing: 2.6,
    textTransform: 'uppercase',
    fontFamily: 'DMSans_700Bold'
  },
  shareHeaderBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#D7FF64',
    alignItems: 'center',
    justifyContent: 'center'
  },

  // Section 1: Hero Music Passport Card
  heroSection: {
    marginBottom: 28
  },
  heroGlassPanel: {
    borderRadius: 32,
    padding: 22,
    backgroundColor: 'rgba(22, 24, 20, 0.88)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 36,
    elevation: 14
  },
  auroraGlow: {
    position: 'absolute',
    top: -20,
    right: -30,
    width: 250,
    height: 250,
    borderRadius: 125,
    opacity: 0.75,
    overflow: 'hidden'
  },
  shimmerBar: {
    position: 'absolute',
    top: -100,
    width: 120,
    height: 600,
    zIndex: 2
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 28
  },
  avatarWrapper: {
    position: 'relative'
  },
  avatarImg: {
    width: 74,
    height: 74,
    borderRadius: 20,
    backgroundColor: '#1C1917'
  },
  avatarSparkBadge: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D7FF64',
    borderWidth: 3,
    borderColor: '#181513',
    alignItems: 'center',
    justifyContent: 'center'
  },
  updatedPill: {
    borderRadius: 9999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)'
  },
  updatedPillBlur: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.35)'
  },
  updatedPillText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.4,
    fontFamily: 'DMSans_700Bold'
  },
  heroMidContent: {
    marginBottom: 26
  },
  passportOwnerText: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 13.5,
    fontWeight: '600',
    marginBottom: 8,
    fontFamily: 'DMSans_500Medium'
  },
  heroArchetypeTitle: {
    fontSize: 44,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1.6,
    lineHeight: 44,
    marginBottom: 12,
    fontFamily: 'DMSans_700Bold'
  },
  heroTagline: {
    fontSize: 13.5,
    color: 'rgba(255, 255, 255, 0.65)',
    lineHeight: 20,
    maxWidth: 290,
    fontFamily: 'DMSans_400Regular'
  },
  heroBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 16
  },
  platformsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  platformIconDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center'
  },
  platformDotLetter: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '900'
  },
  platformsConnectedText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11.5,
    fontWeight: '500',
    marginLeft: 4,
    fontFamily: 'DMSans_500Medium'
  },
  viewPassportLink: {
    color: '#D7FF64',
    fontSize: 12.5,
    fontWeight: '700',
    fontFamily: 'DMSans_700Bold'
  },

  // General Section Elements
  sectionContainer: {
    marginBottom: 32
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 14
  },
  eyebrow: {
    color: '#D7FF64',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 4,
    fontFamily: 'DMSans_700Bold'
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.6,
    fontFamily: 'DMSans_700Bold'
  },
  seeAllText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'DMSans_600SemiBold'
  },

  // Artists Mosaic (Asymmetric)
  artistsMosaicRow: {
    flexDirection: 'row',
    gap: 10,
    height: 250
  },
  artistHeroCard: {
    flex: 1.45,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    position: 'relative',
    padding: 14,
    justifyContent: 'space-between'
  },
  artistRankHero: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1.2,
    fontFamily: 'DMSans_700Bold'
  },
  artistHeroMeta: {
    gap: 2
  },
  artistHeroName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    fontFamily: 'DMSans_700Bold'
  },
  artistHeroGenre: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 11.5,
    fontWeight: '500',
    fontFamily: 'DMSans_500Medium'
  },
  artistsStackedCol: {
    flex: 1,
    gap: 10
  },
  artistSquareCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    position: 'relative',
    padding: 10,
    justifyContent: 'space-between'
  },
  cardCoverImg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%'
  },
  artistRankSquare: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'DMSans_700Bold'
  },
  artistSquareName: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
    fontFamily: 'DMSans_700Bold'
  },
  artistFourthCard: {
    height: 72,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    marginTop: 10
  },
  fourthCardInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16
  },
  fourthCardLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  topTrackTag: {
    color: '#D7FF64',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    fontFamily: 'DMSans_700Bold'
  },
  mosaicFootnote: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 10,
    marginTop: 8,
    fontFamily: 'DMSans_400Regular'
  },

  // Section 3: Music Signature / Pulse
  periodToggleWrapper: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 9999,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  periodToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999
  },
  periodToggleBtnActive: {
    backgroundColor: '#FFFFFF'
  },
  periodToggleText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10.5,
    fontWeight: '700',
    fontFamily: 'DMSans_700Bold'
  },
  periodToggleTextActive: {
    color: '#11120E'
  },
  pulseGlassCard: {
    borderRadius: 26,
    padding: 20,
    backgroundColor: 'rgba(24, 21, 19, 0.90)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    overflow: 'hidden'
  },
  pulseTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 22
  },
  discoveryLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'DMSans_500Medium'
  },
  discoveryScoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline'
  },
  discoveryScoreVal: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1.5,
    fontFamily: 'DMSans_700Bold'
  },
  discoveryScorePercent: {
    fontSize: 22,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '600',
    marginLeft: 2
  },
  explorerTag: {
    backgroundColor: 'rgba(215, 255, 100, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 100, 0.3)'
  },
  explorerTagText: {
    color: '#D7FF64',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'DMSans_700Bold'
  },
  spectrumSlidersContainer: {
    gap: 16
  },
  spectrumRow: {
    gap: 6
  },
  spectrumLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  spectrumEndText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 10.5,
    fontWeight: '600',
    fontFamily: 'DMSans_600SemiBold'
  },
  spectrumTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    overflow: 'hidden'
  },
  spectrumFill: {
    height: '100%',
    borderRadius: 4
  },

  // Section 4: Migration Story
  migrationGrid: {
    gap: 10,
    marginTop: 12
  },
  limeGlassCard: {
    backgroundColor: '#D7FF64',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    position: 'relative',
    overflow: 'hidden'
  },
  limeGlintBar: {
    position: 'absolute',
    top: -50,
    width: 90,
    height: 250,
    zIndex: 1
  },
  limeContentCol: {
    gap: 2
  },
  limeCardTag: {
    fontSize: 10.5,
    fontWeight: '800',
    color: 'rgba(17, 18, 14, 0.65)',
    letterSpacing: 1.4,
    fontFamily: 'DMSans_700Bold'
  },
  limeCardCount: {
    fontSize: 46,
    fontWeight: '800',
    color: '#11120E',
    letterSpacing: -1.2,
    fontFamily: 'DMSans_700Bold'
  },
  migrateCtaBtn: {
    marginTop: 8,
    backgroundColor: '#11120E',
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 20,
    alignSelf: 'flex-start'
  },
  migrateCtaText: {
    color: '#D7FF64',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    fontFamily: 'DMSans_700Bold'
  },
  limeIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.4,
    borderColor: 'rgba(17, 18, 14, 0.2)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  migrationRowCards: {
    flexDirection: 'row',
    gap: 10
  },
  migrationSubCard: {
    flex: 1,
    borderRadius: 22,
    padding: 18,
    backgroundColor: 'rgba(24, 21, 19, 0.90)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  migrationSubCount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    marginBottom: 2,
    fontFamily: 'DMSans_700Bold'
  },
  migrationSubDesc: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
    fontWeight: '500',
    fontFamily: 'DMSans_500Medium'
  },

  // Section 5: Rare Badge
  badgeGlassCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 18,
    borderRadius: 26,
    backgroundColor: 'rgba(24, 21, 19, 0.90)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    marginTop: 12
  },
  floatingBadgeSquare: {
    width: 86,
    height: 86,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)'
  },
  badgeMetaCol: {
    flex: 1,
    gap: 3
  },
  badgeRareTag: {
    color: '#D7FF64',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    fontFamily: 'DMSans_700Bold'
  },
  badgeTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'DMSans_700Bold'
  },
  badgeSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    lineHeight: 16,
    fontFamily: 'DMSans_400Regular'
  },

  // Section 6: Full Share Button
  fullShareCtaBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 9999,
    paddingHorizontal: 22,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20
  },
  fullShareCtaText: {
    color: '#11120E',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'DMSans_700Bold'
  },
  fullShareIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#11120E',
    alignItems: 'center',
    justifyContent: 'center'
  },

  // Section 7: Account Settings & Sign Out
  accountSettingsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20
  },
  recalibrateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 14,
    borderRadius: 9999,
    gap: 8
  },
  recalibrateText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'DMSans_600SemiBold'
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 9999,
    gap: 6
  },
  signOutText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'DMSans_600SemiBold'
  },

  // ShareSheet Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 28
  },
  passportSheetCard: {
    borderRadius: 34,
    padding: 14,
    backgroundColor: 'rgba(30, 26, 24, 0.96)',
    borderWidth: 1.4,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    overflow: 'hidden'
  },
  passportGraphic: {
    backgroundColor: '#D7FF64',
    borderRadius: 26,
    padding: 24,
    position: 'relative',
    overflow: 'hidden'
  },
  passportOrbPurple: {
    position: 'absolute',
    top: -50,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#8B5CF6',
    opacity: 0.85
  },
  passportOrbCoral: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#FF7557',
    opacity: 0.85
  },
  passportGraphicInner: {
    position: 'relative',
    zIndex: 1
  },
  passportGraphicTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 50
  },
  passportCardEyebrow: {
    color: '#11120E',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.2,
    fontFamily: 'DMSans_700Bold'
  },
  passportYearPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999
  },
  passportYearText: {
    color: '#11120E',
    fontSize: 10,
    fontWeight: '900',
    fontFamily: 'DMSans_700Bold'
  },
  passportSoundIsText: {
    color: 'rgba(17, 18, 14, 0.7)',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'DMSans_600SemiBold'
  },
  passportLargeHeadline: {
    fontSize: 42,
    fontWeight: '800',
    color: '#11120E',
    letterSpacing: -1.4,
    lineHeight: 40,
    marginTop: 4,
    marginBottom: 36,
    fontFamily: 'DMSans_700Bold'
  },
  passportGraphicBottomDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(17, 18, 14, 0.15)',
    paddingTop: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between'
  },
  passportArtistsList: {
    color: '#11120E',
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 160,
    fontFamily: 'DMSans_700Bold'
  },
  passportMadeWithTag: {
    color: '#11120E',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: 'DMSans_700Bold'
  },
  passportBrandTag: {
    color: '#11120E',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
    fontFamily: 'DMSans_700Bold'
  },
  passportActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12
  },
  copyLinkBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 9999,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  copyLinkText: {
    color: '#11120E',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'DMSans_700Bold'
  },
  closeModalBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)'
  }
});
