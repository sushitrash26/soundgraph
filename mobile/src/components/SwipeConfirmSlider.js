import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { ChevronsRight, Check } from 'lucide-react-native';
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

const DEFAULT_HEIGHT = 56;
const THUMB_MARGIN = 4;

export default function SwipeConfirmSlider({
  label = 'Swipe to Confirm',
  accentColor = '#d7ff64',
  thumbIcon: ThumbIcon,
  onConfirm,
  disabled = false,
  height = DEFAULT_HEIGHT,
  style
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  const thumbSize = height - THUMB_MARGIN * 2;
  const maxTranslateX = Math.max(0, trackWidth - thumbSize - THUMB_MARGIN * 2);

  const translateX = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const triggerSuccessHaptic = () => {
    'worklet';
    runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Success);
  };

  const triggerLightHaptic = () => {
    'worklet';
    runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleComplete = () => {
    setIsCompleted(true);
    if (onConfirm) {
      onConfirm();
    }
    // Automatically reset slider after confirmation
    setTimeout(() => {
      translateX.value = withSpring(0, { damping: 22, stiffness: 220 });
      setIsCompleted(false);
    }, 1100);
  };

  const panGesture = Gesture.Pan()
    .enabled(!disabled && !isCompleted && maxTranslateX > 0)
    .onBegin(() => {
      isDragging.value = true;
      triggerLightHaptic();
    })
    .onUpdate((e) => {
      const clampedX = Math.max(0, Math.min(e.translationX, maxTranslateX));
      translateX.value = clampedX;
    })
    .onEnd((e) => {
      isDragging.value = false;
      const progress = maxTranslateX > 0 ? translateX.value / maxTranslateX : 0;
      const velocity = e.velocityX;

      if (progress > 0.78 || velocity > 750) {
        // Confirm snap
        translateX.value = withTiming(maxTranslateX, { duration: 160 }, () => {
          triggerSuccessHaptic();
          runOnJS(handleComplete)();
        });
      } else {
        // Snap back to left
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  // Animated style for sliding thumb handle
  const thumbAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }]
    };
  });

  // Dynamic progress fill track that follows behind thumb
  const fillTrackAnimatedStyle = useAnimatedStyle(() => {
    const fillWidth = translateX.value + thumbSize + THUMB_MARGIN * 2;
    return {
      width: fillWidth
    };
  });

  // Fade out label as thumb moves across it
  const labelAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [0, maxTranslateX * 0.65],
      [1, 0.15],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  return (
    <View
      style={[
        styles.trackContainer,
        { height, borderRadius: height / 2 },
        disabled && styles.disabledContainer,
        style
      ]}
      onLayout={(e) => {
        const { width } = e.nativeEvent.layout;
        setTrackWidth(width);
      }}
    >
      {/* Background Fill Track */}
      <Animated.View
        style={[
          styles.fillTrack,
          {
            backgroundColor: accentColor,
            borderRadius: height / 2
          },
          fillTrackAnimatedStyle
        ]}
      />

      {/* Centered Shimmer Label */}
      <Animated.View style={[styles.labelWrapper, labelAnimatedStyle]} pointerEvents="none">
        <Text style={styles.labelText}>
          {isCompleted ? 'Confirmed ✓' : label}
        </Text>
        {!isCompleted && (
          <View style={styles.chevronsRow}>
            <ChevronsRight size={16} color="rgba(255, 255, 255, 0.55)" strokeWidth={2.4} />
          </View>
        )}
      </Animated.View>

      {/* Sliding Circular Thumb Handle */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.thumb,
            {
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbSize / 2,
              backgroundColor: isCompleted ? '#FFFFFF' : accentColor
            },
            thumbAnimatedStyle
          ]}
        >
          {isCompleted ? (
            <Check size={22} color="#000000" strokeWidth={3} />
          ) : ThumbIcon ? (
            <ThumbIcon size={20} color="#000000" strokeWidth={2.4} />
          ) : (
            <ChevronsRight size={22} color="#000000" strokeWidth={2.6} />
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  trackContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    overflow: 'hidden',
    justifyContent: 'center',
    position: 'relative'
  },
  disabledContainer: {
    opacity: 0.45
  },
  fillTrack: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.22
  },
  labelWrapper: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 54
  },
  labelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.4
  },
  chevronsRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  thumb: {
    position: 'absolute',
    left: THUMB_MARGIN,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6
  }
});
