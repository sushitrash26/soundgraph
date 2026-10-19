import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  Dimensions
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  Play,
  Pause,
  Sparkles,
  Zap,
  Activity,
  Heart,
  X as XIcon
} from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  runOnJS,
  Extrapolation
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 36;
const CARD_HEIGHT = Math.min(SCREEN_HEIGHT * 0.62, 510);
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;

export default function ThreeDDeckCard({
  card,
  index = 0, // 0 = active top, 1 = behind, 2 = deep behind
  totalCards = 5,
  isPlaying = false,
  onTogglePlay,
  onSwipeLeft,
  onSwipeRight,
  dragProgress // SharedValue from parent if coordinating multiple cards
}) {
  const isTop = index === 0;

  // 3D Motion Shared Values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const touchStartY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  // Trigger Haptics on JS thread
  const triggerHaptic = (type) => {
    'worklet';
    if (type === 'medium') {
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
    } else if (type === 'light') {
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleFinishSwipe = (direction) => {
    if (direction === 'right' && onSwipeRight) {
      onSwipeRight(card);
    } else if (direction === 'left' && onSwipeLeft) {
      onSwipeLeft(card);
    }
  };

  // True Multi-Axis Grab Gesture with Center-Offset Torque
  const panGesture = Gesture.Pan()
    .enabled(isTop)
    .onBegin((e) => {
      isDragging.value = true;
      // Offset from vertical center (-CARD_HEIGHT/2 to +CARD_HEIGHT/2)
      touchStartY.value = e.y - CARD_HEIGHT / 2;
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
      if (dragProgress) {
        dragProgress.value = Math.abs(e.translationX) / SWIPE_THRESHOLD;
      }
    })
    .onEnd((e) => {
      isDragging.value = false;
      const throwVelocity = e.velocityX;

      if (translateX.value > SWIPE_THRESHOLD || throwVelocity > 600) {
        // Swiped Right -> Like
        triggerHaptic('medium');
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 240 }, () => {
          runOnJS(handleFinishSwipe)('right');
        });
        translateY.value = withTiming(translateY.value + e.velocityY * 0.15, { duration: 240 });
      } else if (translateX.value < -SWIPE_THRESHOLD || throwVelocity < -600) {
        // Swiped Left -> Pass
        triggerHaptic('light');
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 240 }, () => {
          runOnJS(handleFinishSwipe)('left');
        });
        translateY.value = withTiming(translateY.value + e.velocityY * 0.15, { duration: 240 });
      } else {
        // Snap back to neutral 3D position
        translateX.value = withSpring(0, { damping: 18, stiffness: 160 });
        translateY.value = withSpring(0, { damping: 18, stiffness: 160 });
        if (dragProgress) {
          dragProgress.value = withSpring(0);
        }
      }
    });

  // Top Card 3D Perspective Transformation
  const topCardAnimatedStyle = useAnimatedStyle(() => {
    // Multi-axis rotation mapping
    // Yaw (rotateY): horizontal drag turns card left/right
    const rotateY = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [24, 0, -24],
      Extrapolation.CLAMP
    );

    // Pitch (rotateX): vertical drag tilts card forward/backward
    const rotateX = interpolate(
      translateY.value,
      [-SCREEN_HEIGHT / 2, 0, SCREEN_HEIGHT / 2],
      [-16, 0, 16],
      Extrapolation.CLAMP
    );

    // Roll (rotateZ): torque created by grabbing off-center
    // If you grab near top edge, card tilts in the direction of the drag
    const torqueFactor = touchStartY.value / (CARD_HEIGHT / 2); // -1.0 to +1.0
    const rotateZ = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-14 * (torqueFactor < 0 ? -1 : 1), 0, 14 * (torqueFactor < 0 ? -1 : 1)],
      Extrapolation.CLAMP
    );

    // Slight lift toward camera when dragging
    const scale = isDragging.value ? withSpring(1.02) : withSpring(1.0);

    return {
      transform: [
        { perspective: 900 },
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotateX: `${rotateX}deg` },
        { rotateY: `${rotateY}deg` },
        { rotateZ: `${rotateZ}deg` },
        { scale }
      ],
      zIndex: 100
    };
  });

  // Background Stacked Cards (Index 1 & 2) 3D Depth Interpolation
  const stackCardAnimatedStyle = useAnimatedStyle(() => {
    const progress = dragProgress ? Math.min(dragProgress.value, 1) : 0;

    // As top card is dragged, card 1 advances toward position 0
    const baseScale = index === 1 ? 0.93 : 0.86;
    const targetScale = index === 1 ? 1.0 : 0.93;
    const currentScale = interpolate(progress, [0, 1], [baseScale, targetScale]);

    const baseTranslateY = index === 1 ? 18 : 34;
    const targetTranslateY = index === 1 ? 0 : 18;
    const currentTranslateY = interpolate(progress, [0, 1], [baseTranslateY, targetTranslateY]);

    const baseRotateX = index === 1 ? 5 : 9;
    const targetRotateX = index === 1 ? 0 : 5;
    const currentRotateX = interpolate(progress, [0, 1], [baseRotateX, targetRotateX]);

    const baseOpacity = index === 1 ? 0.88 : 0.55;
    const targetOpacity = index === 1 ? 1.0 : 0.88;
    const currentOpacity = interpolate(progress, [0, 1], [baseOpacity, targetOpacity]);

    return {
      transform: [
        { perspective: 900 },
        { translateY: currentTranslateY },
        { rotateX: `${currentRotateX}deg` },
        { scale: currentScale }
      ],
      opacity: currentOpacity,
      zIndex: 10 - index
    };
  });

  // Stamp Opacity Animations
  const likeStampStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [15, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  const passStampStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, -15],
      [1, 0],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  // Specular Reflection Glint that tracks 3D yaw/pitch
  const glintStyle = useAnimatedStyle(() => {
    const glintX = interpolate(
      translateX.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-CARD_WIDTH * 0.5, 0, CARD_WIDTH * 0.5],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateX: glintX }]
    };
  });

  const animatedContainerStyle = isTop ? topCardAnimatedStyle : stackCardAnimatedStyle;

  const title = card.track_name || card.title || card.name || 'Harmonic Track';
  const artist = Array.isArray(card.artists)
    ? card.artists.join(', ')
    : (card.artist || 'Featured Artist');

  if (!card) return null;

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.cardContainer, animatedContainerStyle]}>
        {/* Main Smoked Frosted Acrylic Glass Body */}
        <BlurView intensity={80} tint="dark" style={styles.glassBody}>
          {/* Moving 3D Specular Glint Overlay */}
          <Animated.View style={[styles.specularGlintWrapper, glintStyle]}>
            <LinearGradient
              colors={[
                'rgba(255, 255, 255, 0.0)',
                'rgba(255, 255, 255, 0.12)',
                'rgba(255, 255, 255, 0.0)'
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* Swipe Decision Stamps */}
          {isTop && (
            <>
              <Animated.View style={[styles.decisionStamp, styles.stampKeep, likeStampStyle]}>
                <Heart size={18} color="#FFFFFF" strokeWidth={2.8} style={{ marginRight: 6 }} />
                <Text style={styles.stampTextKeep}>KEEP</Text>
              </Animated.View>

              <Animated.View style={[styles.decisionStamp, styles.stampPass, passStampStyle]}>
                <XIcon size={18} color="#FFFFFF" strokeWidth={2.8} style={{ marginRight: 6 }} />
                <Text style={styles.stampTextPass}>PASS</Text>
              </Animated.View>
            </>
          )}

          {/* Cover Art Squircle with Live Preview Pill */}
          <View style={styles.coverWrapper}>
            <Image
              source={{ uri: card.cover_url }}
              style={styles.coverImage}
              resizeMode="cover"
            />

            {/* Live Audio Preview Pill (Only active on top card) */}
            {isTop && (
              <Pressable
                style={styles.audioPill}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (onTogglePlay) onTogglePlay(card);
                }}
              >
                <BlurView intensity={80} tint="dark" style={styles.audioPillBlur}>
                  {isPlaying ? (
                    <>
                      <Pause size={13} color="#FFFFFF" />
                      <Text style={styles.audioPillText}>Playing 30s</Text>
                    </>
                  ) : (
                    <>
                      <Play size={13} color="#FFFFFF" fill="#FFFFFF" />
                      <Text style={styles.audioPillText}>Preview</Text>
                    </>
                  )}
                </BlurView>
              </Pressable>
            )}

            {/* Acoustic Energy Badge */}
            {card.energy && (
              <View style={styles.energyBadge}>
                <BlurView intensity={80} tint="dark" style={styles.energyBadgeBlur}>
                  <Zap size={11} color="#FFFFFF" />
                  <Text style={styles.energyText}>{Math.round(card.energy * 100)}% Energy</Text>
                </BlurView>
              </View>
            )}
          </View>

          {/* Card Metadata Section (Cleanly displayed only on active top card to avoid stack double-vision) */}
          {isTop ? (
            <View style={styles.contentSection}>
              <View style={styles.titleRow}>
                <View style={styles.titleCol}>
                  <Text style={styles.trackTitle} numberOfLines={1}>
                    {title}
                  </Text>
                  <Text style={styles.trackArtist} numberOfLines={1}>
                    {artist}
                  </Text>
                </View>
              </View>

              {/* Recommendation Reason Pill */}
              <View style={styles.reasonBadge}>
                <Sparkles size={12} color="rgba(255, 255, 255, 0.9)" style={{ marginRight: 6 }} />
                <Text style={styles.reasonText} numberOfLines={1}>
                  {card.reason || card.quadrant || 'Curated For Your Sonic Baseline'}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.stackedBottomSpacer} />
          )}
        </BlurView>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 16
  },
  glassBody: {
    flex: 1,
    borderRadius: 32,
    backgroundColor: 'rgba(24, 21, 19, 0.92)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    padding: 16,
    overflow: 'hidden',
    justifyContent: 'space-between'
  },
  specularGlintWrapper: {
    ...StyleSheet.absoluteFillObject,
    width: CARD_WIDTH * 2,
    opacity: 0.8
  },
  decisionStamp: {
    position: 'absolute',
    top: 26,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 9999,
    borderWidth: 1.6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10
  },
  stampKeep: {
    right: 24,
    backgroundColor: 'rgba(16, 185, 129, 0.35)',
    borderColor: '#10B981',
    transform: [{ rotate: '12deg' }]
  },
  stampPass: {
    left: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.35)',
    borderColor: '#EF4444',
    transform: [{ rotate: '-12deg' }]
  },
  stampTextKeep: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1.4
  },
  stampTextPass: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1.4
  },
  coverWrapper: {
    width: '100%',
    height: '58%',
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative'
  },
  coverImage: {
    width: '100%',
    height: '100%'
  },
  audioPill: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    borderRadius: 9999,
    overflow: 'hidden'
  },
  audioPillBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    gap: 6
  },
  audioPillText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700'
  },
  energyBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    borderRadius: 9999,
    overflow: 'hidden'
  },
  energyBadgeBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    gap: 4
  },
  energyText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700'
  },
  contentSection: {
    paddingHorizontal: 4,
    paddingTop: 10,
    paddingBottom: 4
  },
  titleRow: {
    marginBottom: 8
  },
  titleCol: {
    width: '100%'
  },
  trackTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    marginBottom: 3
  },
  trackArtist: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.72)'
  },
  reasonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.20)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  reasonText: {
    color: 'rgba(255, 255, 255, 0.92)',
    fontSize: 12,
    fontWeight: '600',
    flex: 1
  },
  stackedBottomSpacer: {
    height: 48
  }
});
