import React from 'react';
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
  Sparkles,
  Music2
} from 'lucide-react-native';
import { useSharedValue } from 'react-native-reanimated';
import { THEME } from '../theme/theme';
import { useMobileStore } from '../store/useMobileStore';
import AmbientGlassBackground from '../components/AmbientGlassBackground';
import OnboardingMilestoneModal from '../components/OnboardingMilestoneModal';
import ThreeDDeckCard from '../components/ThreeDDeckCard';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function FirstDeckScreen() {
  const {
    firstDeckCards,
    currentFirstDeckIndex,
    rateFirstDeckCard,
    toggleAudioPreview,
    playingTrackId,
    isPlayingAudio,
    isLoadingFirstDeck,
    onboardingStep
  } = useMobileStore();

  const dragProgress = useSharedValue(0);

  const currentCard = firstDeckCards[currentFirstDeckIndex] || null;
  const nextCard1 = firstDeckCards[currentFirstDeckIndex + 1] || null;
  const nextCard2 = firstDeckCards[currentFirstDeckIndex + 2] || null;

  const isPlayingThisTrack = isPlayingAudio && playingTrackId === (currentCard?.track_id || currentCard?.id);

  const handlePressLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    rateFirstDeckCard('like');
  };

  const handlePressPass = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    rateFirstDeckCard('pass');
  };

  return (
    <View style={styles.container}>
      <AmbientGlassBackground />

      {/* Top Floating Glass Header Pill */}
      <View style={styles.header}>
        <View style={styles.headerPillWrapper}>
          <BlurView intensity={75} tint="light" style={styles.headerPillBlur}>
            <Text style={styles.headerTag}>CURATED FIRST DECK</Text>
            <View style={styles.headerDivider} />
            <Text style={styles.headerCounter}>
              {Math.min(currentFirstDeckIndex + 1, 5)} of 5
            </Text>
          </BlurView>
        </View>
      </View>

      {/* 3D Multi-Layer Deck Perspective Arena */}
      <View style={styles.deckArena}>
        {isLoadingFirstDeck ? (
          <View style={styles.loadingView}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Synthesizing your 5-quadrant baseline...</Text>
          </View>
        ) : currentCard ? (
          <View style={styles.stackWrapper}>
            {/* Third Card in 3D Depth (Furthest) */}
            {nextCard2 && (
              <ThreeDDeckCard
                key={nextCard2.track_id || nextCard2.id}
                card={nextCard2}
                index={2}
                dragProgress={dragProgress}
              />
            )}

            {/* Second Card in 3D Depth (Middle) */}
            {nextCard1 && (
              <ThreeDDeckCard
                key={nextCard1.track_id || nextCard1.id}
                card={nextCard1}
                index={1}
                dragProgress={dragProgress}
              />
            )}

            {/* Top Interactive 3D Card (Active) */}
            <ThreeDDeckCard
              key={currentCard.track_id || currentCard.id}
              card={currentCard}
              index={0}
              isPlaying={isPlayingThisTrack}
              onTogglePlay={() => toggleAudioPreview(currentCard)}
              onSwipeRight={() => rateFirstDeckCard('like')}
              onSwipeLeft={() => rateFirstDeckCard('pass')}
              dragProgress={dragProgress}
            />
          </View>
        ) : (
          <View style={styles.emptyDeckView}>
            <Sparkles size={32} color="#FFFFFF" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyDeckTitle}>Baseline Calibrated</Text>
            <Text style={styles.emptyDeckSub}>Preparing your continuous feed...</Text>
          </View>
        )}
      </View>

      {/* Interactive 3D Tutorial Pill */}
      {currentFirstDeckIndex === 0 && (
        <View style={styles.tutorialContainer}>
          <BlurView intensity={70} tint="light" style={styles.tutorialBlur}>
            <Text style={styles.tutorialText}>
              Drag to tilt in 3D • Swipe Left (Pass) • Swipe Right (Keep)
            </Text>
          </BlurView>
        </View>
      )}

      {/* Bottom Floating Glass Action Controls */}
      <View style={styles.controlsRow}>
        {/* Pass Button */}
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

        {/* Keep / Like Button */}
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

      {/* Onboarding Milestone Modal */}
      <OnboardingMilestoneModal visible={onboardingStep === 'milestone'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E0C0B',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 28
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20
  },
  headerPillWrapper: {
    borderRadius: 9999,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12
  },
  headerPillBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.12)'
  },
  headerTag: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.2
  },
  headerDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 10
  },
  headerCounter: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  deckArena: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12
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
    color: 'rgba(255, 255, 255, 0.65)'
  },
  tutorialContainer: {
    alignItems: 'center',
    marginBottom: 8
  },
  tutorialBlur: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 9999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    overflow: 'hidden'
  },
  tutorialText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '600',
    letterSpacing: 0.3
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 28,
    paddingHorizontal: 20
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
