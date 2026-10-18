import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Image, 
  Pressable, 
  Dimensions, 
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { 
  Play, 
  Pause, 
  Heart, 
  X, 
  Sparkles, 
  Bookmark, 
  Radio, 
  TrendingUp, 
  Tv, 
  Music,
  RotateCcw
} from 'lucide-react-native';
import { THEME } from '../theme/theme';
import { useMobileStore } from '../store/useMobileStore';
import Sparkler3D from '../components/Sparkler3D';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 40, 360);

export default function CuratedDeckScreen() {
  const {
    curatedDeck,
    currentCardIndex,
    isLoadingDeck,
    deckError,
    fetchCuratedDeck,
    swipeDeckCard,
    toggleAudioPreview,
    playingTrackId,
    isPlayingAudio,
    openAuthModal,
    user
  } = useMobileStore();

  useEffect(() => {
    if (curatedDeck.length === 0) {
      fetchCuratedDeck();
    }
  }, []);

  const currentTrack = curatedDeck[currentCardIndex];
  const isPlayingThis = isPlayingAudio && playingTrackId === currentTrack?.track_id;
  const isYouTube = currentTrack?.source === 'youtube';

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    swipeDeckCard('like');
  };

  const handleDislike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    swipeDeckCard('dislike');
  };

  const handleSuperLike = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    swipeDeckCard('like');
  };

  if (isLoadingDeck && curatedDeck.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.colors.accent} />
        <Text style={styles.loadingTitle}>Querying Latent Knowledge Graph...</Text>
        <Text style={styles.loadingSub}>Curating your cross-platform harmonic deck</Text>
      </View>
    );
  }

  if (!currentTrack) {
    return (
      <View style={styles.emptyContainer}>
        <Sparkles size={36} color={THEME.colors.accent} />
        <Text style={styles.emptyTitle}>Deck Finished</Text>
        <Text style={styles.emptySub}>You have reviewed all current recommendations in this session.</Text>
        <Pressable
          style={styles.reloadBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            fetchCuratedDeck();
          }}
        >
          <RotateCcw size={16} color="#FFF" />
          <Text style={styles.reloadBtnText}>Refresh Curated Deck</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 3D Moving Sparkler Particle Envelope */}
      <View style={styles.sparklerWrapper} pointerEvents="none">
        <Sparkler3D
          width={CARD_WIDTH + 60}
          height={430}
          accentColor={isYouTube ? '#EF4444' : '#A855F7'}
          active={true}
        />
      </View>

      {/* Main Curated Card */}
      <View style={[styles.card, { width: CARD_WIDTH }]}>
        {/* Album Artwork & Play Trigger */}
        <View style={styles.artworkContainer}>
          <Image
            source={{ uri: currentTrack.cover_url || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600' }}
            style={styles.artwork}
          />
          <LinearGradient
            colors={['transparent', 'rgba(10, 10, 14, 0.85)']}
            style={styles.artworkVignette}
          />

          {/* Platform Origin Badge */}
          <View style={styles.originBadge}>
            {isYouTube ? (
              <>
                <Tv size={12} color="#EF4444" />
                <Text style={[styles.originText, { color: '#FCA5A5' }]}>YouTube Music</Text>
              </>
            ) : (
              <>
                <Music size={12} color="#1DB954" />
                <Text style={[styles.originText, { color: '#86EFAC' }]}>Spotify</Text>
              </>
            )}
          </View>

          {/* Latent Affinity Score Badge */}
          <View style={styles.scoreBadge}>
            <TrendingUp size={12} color="#A855F7" />
            <Text style={styles.scoreText}>
              {Math.round((currentTrack.score || 0.95) * 100)}% Match
            </Text>
          </View>

          {/* Play/Pause 30s Audio Preview Pill */}
          {currentTrack.preview_url ? (
            <Pressable
              style={[styles.audioPill, isPlayingThis && styles.audioPillActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                toggleAudioPreview(currentTrack);
              }}
            >
              {isPlayingThis ? (
                <>
                  <Pause size={14} color="#FFF" />
                  <Text style={styles.audioPillText}>Playing Preview</Text>
                </>
              ) : (
                <>
                  <Play size={14} color="#FFF" />
                  <Text style={styles.audioPillText}>
                    {isYouTube ? 'Play on YouTube' : 'Play 30s Preview'}
                  </Text>
                </>
              )}
            </Pressable>
          ) : (
            <View style={styles.audioPillDisabled}>
              <Text style={styles.audioPillDisabledText}>No Preview Audio</Text>
            </View>
          )}
        </View>

        {/* Track Metadata Section */}
        <View style={styles.metaSection}>
          <Text style={styles.trackTitle} numberOfLines={1}>
            {currentTrack.track_name || 'Curated Latent Track'}
          </Text>
          <Text style={styles.artistName} numberOfLines={1}>
            {Array.isArray(currentTrack.artists) ? currentTrack.artists.join(', ') : 'Artist'}
          </Text>

          {/* Recommendation Latent Reasoning */}
          {currentTrack.reason && (
            <View style={styles.reasonRow}>
              <Sparkles size={12} color="#A855F7" />
              <Text style={styles.reasonText} numberOfLines={1}>
                {currentTrack.reason}
              </Text>
            </View>
          )}

          {/* Harmonic Transition Flow (if available) */}
          {currentTrack.transition_flow && (
            <Text style={styles.transitionText}>
              Harmonic Flow: {currentTrack.transition_flow}
            </Text>
          )}

          {/* Genre Cluster Pills */}
          <View style={styles.genreRow}>
            {currentTrack.genres && currentTrack.genres.slice(0, 3).map((g, i) => (
              <View key={i} style={styles.genrePill}>
                <Text style={styles.genreText}>{g}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Thumb-Zone Ergonomic Controls */}
      <View style={styles.controlsRow}>
        {/* Dislike Action */}
        <Pressable
          style={[styles.controlBtn, styles.dislikeBtn]}
          onPress={handleDislike}
        >
          <X size={24} color="#EF4444" strokeWidth={2.4} />
        </Pressable>

        {/* Audio Toggle Action */}
        {currentTrack.preview_url && (
          <Pressable
            style={[styles.controlBtn, styles.playBtn, isPlayingThis && styles.playBtnActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              toggleAudioPreview(currentTrack);
            }}
          >
            {isPlayingThis ? (
              <Pause size={24} color="#FFFFFF" />
            ) : (
              <Play size={24} color="#FFFFFF" style={{ marginLeft: 3 }} />
            )}
          </Pressable>
        )}

        {/* Super Like / Discovery Action */}
        <Pressable
          style={[styles.controlBtn, styles.likeBtn]}
          onPress={handleSuperLike}
        >
          <Heart size={26} color="#FFFFFF" fill="#A855F7" strokeWidth={1} />
        </Pressable>
      </View>

      {/* Upcoming Deck Preview Counter */}
      <View style={styles.queueCounterRow}>
        <Text style={styles.queueCounterText}>
          Card {currentCardIndex + 1} of {curatedDeck.length} · Contextual Bandit Active
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    position: 'relative'
  },
  sparklerWrapper: {
    position: 'absolute',
    top: '4%',
    alignSelf: 'center',
    zIndex: 1
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    borderRadius: THEME.radius.xl,
    overflow: 'hidden',
    zIndex: 2
  },
  artworkContainer: {
    width: '100%',
    height: 270,
    position: 'relative'
  },
  artwork: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  artworkVignette: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 120
  },
  originBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 10, 14, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  originText: {
    fontSize: 11,
    fontWeight: '700'
  },
  scoreBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)'
  },
  scoreText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#E9D5FF'
  },
  audioPill: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)'
  },
  audioPillActive: {
    backgroundColor: THEME.colors.accent,
    borderColor: '#FFFFFF'
  },
  audioPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700'
  },
  audioPillDisabled: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.full
  },
  audioPillDisabledText: {
    color: THEME.colors.textMuted,
    fontSize: 10.5
  },
  metaSection: {
    padding: 18
  },
  trackTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: THEME.colors.textPrimary
  },
  artistName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginTop: 2
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radius.sm
  },
  reasonText: {
    fontSize: 11.5,
    color: '#D8B4FE',
    fontWeight: '600'
  },
  transitionText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 6
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12
  },
  genrePill: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: THEME.radius.sm
  },
  genreText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontWeight: '600'
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    marginTop: 22,
    zIndex: 3
  },
  controlBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle
  },
  dislikeBtn: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)'
  },
  playBtn: {
    backgroundColor: THEME.colors.surfaceHighlight,
    borderColor: THEME.colors.borderActive
  },
  playBtnActive: {
    backgroundColor: THEME.colors.accent
  },
  likeBtn: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderColor: 'rgba(168, 85, 247, 0.5)'
  },
  queueCounterRow: {
    marginTop: 14
  },
  queueCounterText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12
  },
  loadingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary
  },
  loadingSub: {
    fontSize: 12,
    color: THEME.colors.textSecondary
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary
  },
  emptySub: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18
  },
  reloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: THEME.radius.md,
    marginTop: 6
  },
  reloadBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700'
  }
});
