import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import {
  Heart,
  X,
  Radio,
  Sparkles,
  RotateCcw
} from 'lucide-react-native';
import { useSharedValue } from 'react-native-reanimated';
import { THEME } from '../theme/theme';
import { useMobileStore } from '../store/useMobileStore';
import AmbientGlassBackground from '../components/AmbientGlassBackground';
import ThreeDDeckCard from '../components/ThreeDDeckCard';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function InfiniteDeckScreen() {
  const {
    infiniteDeck,
    infiniteIndex,
    isLoadingInfiniteDeck,
    fetchInfiniteDeck,
    swipeInfiniteCard,
    toggleAudioPreview,
    playingTrackId,
    isPlayingAudio
  } = useMobileStore();

  const dragProgress = useSharedValue(0);

  useEffect(() => {
    if (infiniteDeck.length === 0) {
      fetchInfiniteDeck();
    }
  }, []);

  const currentCard = infiniteDeck[infiniteIndex] || null;
  const nextCard1 = infiniteDeck[infiniteIndex + 1] || null;
  const nextCard2 = infiniteDeck[infiniteIndex + 2] || null;

  const isPlayingThisTrack = isPlayingAudio && playingTrackId === (currentCard?.track_id || currentCard?.id);

  const handlePressLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    swipeInfiniteCard('like');
  };

  const handlePressPass = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    swipeInfiniteCard('pass');
  };

  return (
    <View style={styles.container}>
      <AmbientGlassBackground />

      {/* Top Floating Glass Status Header */}
      <View style={styles.header}>
        <View style={styles.liveBadgeWrapper}>
          <BlurView intensity={75} tint="light" style={styles.liveBadgeBlur}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>CONTINUOUS 24/7 DISCOVERY</Text>
          </BlurView>
        </View>
      </View>

      {/* 3D Multi-Layer Deck Arena */}
      <View style={styles.deckArena}>
        {isLoadingInfiniteDeck && infiniteDeck.length === 0 ? (
          <View style={styles.loadingView}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Synthesizing next batch from graph...</Text>
          </View>
        ) : currentCard ? (
          <View style={styles.stackWrapper}>
            {/* Third Stacked Card */}
            {nextCard2 && (
              <ThreeDDeckCard
                key={nextCard2.track_id || nextCard2.id}
                card={nextCard2}
                index={2}
                dragProgress={dragProgress}
              />
            )}

            {/* Second Stacked Card */}
            {nextCard1 && (
              <ThreeDDeckCard
                key={nextCard1.track_id || nextCard1.id}
                card={nextCard1}
                index={1}
                dragProgress={dragProgress}
              />
            )}

            {/* Active Top 3D Card */}
            <ThreeDDeckCard
              key={currentCard.track_id || currentCard.id}
              card={currentCard}
              index={0}
              isPlaying={isPlayingThisTrack}
              onTogglePlay={() => toggleAudioPreview(currentCard)}
              onSwipeRight={() => swipeInfiniteCard('like')}
              onSwipeLeft={() => swipeInfiniteCard('pass')}
              dragProgress={dragProgress}
            />
          </View>
        ) : (
          <View style={styles.emptyDeckView}>
            <RotateCcw size={32} color="#FFFFFF" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyDeckTitle}>Buffer Refreshing</Text>
            <Text style={styles.emptyDeckSub}>Querying adjacent graph communities...</Text>
            <Pressable
              style={styles.refreshButton}
              onPress={() => fetchInfiniteDeck()}
            >
              <Text style={styles.refreshButtonText}>Reload Recommendations</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Bottom Floating Control Buttons */}
      <View style={styles.controlsRow}>
        <Pressable
          style={({ pressed }) => [
            styles.actionCircleButton,
            pressed && styles.buttonPressed
          ]}
          onPress={handlePressPass}
          disabled={!currentCard}
        >
          <BlurView intensity={75} tint="light" style={styles.actionCircleBlur}>
            <X size={26} color="#FFFFFF" strokeWidth={2.4} />
          </BlurView>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.actionCircleButton,
            styles.likeActionCircle,
            pressed && styles.buttonPressed
          ]}
          onPress={handlePressLike}
          disabled={!currentCard}
        >
          <BlurView intensity={75} tint="light" style={styles.actionCircleBlur}>
            <Heart size={26} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2.4} />
          </BlurView>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E0C0B',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 94
  },
  header: {
    alignItems: 'center',
    paddingVertical: 4
  },
  liveBadgeWrapper: {
    borderRadius: 9999,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12
  },
  liveBadgeBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.12)'
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6
  },
  liveText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8
  },
  deckArena: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10
  },
  stackWrapper: {
    width: SCREEN_WIDTH - 36,
    height: Math.min(SCREEN_HEIGHT * 0.62, 510),
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingView: {
    alignItems: 'center',
    padding: 24
  },
  loadingText: {
    marginTop: 14,
    fontSize: 13.5,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '600'
  },
  emptyDeckView: {
    alignItems: 'center',
    padding: 32
  },
  emptyDeckTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6
  },
  emptyDeckSub: {
    fontSize: 13.5,
    color: 'rgba(255, 255, 255, 0.65)',
    marginBottom: 16
  },
  refreshButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 9999
  },
  refreshButtonText: {
    color: '#0E0C0B',
    fontSize: 13,
    fontWeight: '700'
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 28
  },
  actionCircleButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1.4,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 18
  },
  likeActionCircle: {
    borderColor: 'rgba(255, 255, 255, 0.45)'
  },
  actionCircleBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)'
  },
  buttonPressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.85
  }
});
