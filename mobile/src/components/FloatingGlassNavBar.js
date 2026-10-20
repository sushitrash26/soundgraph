import React, { useEffect, useState, useMemo, useRef } from 'react';
import { StyleSheet, View, Text, Pressable, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  Easing
} from 'react-native-reanimated';
import { Home, Radio, ArrowLeftRight, User } from 'lucide-react-native';
import { useMobileStore } from '../store/useMobileStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TABS = [
  { id: 'recommendations', label: 'Home', icon: Home },
  { id: 'lens', label: 'Lens', icon: Radio },
  { id: 'migration', label: 'Move', icon: ArrowLeftRight },
  { id: 'profile', label: 'Profile', icon: User }
];

// Individual Animated Tab Item
function AnimatedTabButton({ tab, isActive, onPress, onLayout }) {
  const scale = useSharedValue(isActive ? 1.05 : 1);
  const IconComponent = tab.icon;

  useEffect(() => {
    scale.value = withSpring(isActive ? 1.05 : 1, {
      damping: 14,
      stiffness: 220
    });
  }, [isActive]);

  const animatedContentStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }]
    };
  });

  return (
    <Pressable
      style={({ pressed }) => [
        styles.tabButton,
        pressed && styles.tabPressed
      ]}
      onPress={onPress}
      onLayout={onLayout}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={tab.label}
    >
      <Animated.View style={[styles.tabContentInner, animatedContentStyle]}>
        <IconComponent
          size={18}
          color={isActive ? '#11120E' : 'rgba(255, 255, 255, 0.48)'}
          strokeWidth={isActive ? 2.5 : 1.9}
        />
        <Text
          style={[
            styles.tabLabel,
            isActive ? styles.tabLabelActive : styles.tabLabelInactive
          ]}
        >
          {tab.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default function FloatingGlassNavBar({ currentTab: propTab, onSelectTab }) {
  const insets = useSafeAreaInsets();
  const storeTab = useMobileStore((state) => state.currentTab);
  const storeSetCurrentTab = useMobileStore((state) => state.setCurrentTab);

  const activeTab = propTab || storeTab || 'recommendations';
  const activeIndex = useMemo(() => {
    const idx = TABS.findIndex((t) => t.id === activeTab);
    return idx >= 0 ? idx : 0;
  }, [activeTab]);

  const prevIndexRef = useRef(activeIndex);
  const [tabLayouts, setTabLayouts] = useState({});
  const isFirstLayoutRef = useRef(true);

  // Reanimated Physics Values for the sliding pill
  const translateX = useSharedValue(0);
  const pillWidth = useSharedValue(0);
  const pillScaleX = useSharedValue(1);
  const pillOpacity = useSharedValue(0);

  // Estimate initial geometry based on dock width before onLayout completes
  const estimatedDockWidth = Math.min(SCREEN_WIDTH - 40, 390);
  const estimatedTabWidth = (estimatedDockWidth - 16) / TABS.length;

  const handleTabPress = (tabId) => {
    if (activeTab !== tabId) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (onSelectTab) {
        onSelectTab(tabId);
      } else {
        storeSetCurrentTab(tabId);
      }
    }
  };

  const handleTabLayout = (tabId, event) => {
    const { x, width } = event.nativeEvent.layout;
    if (width > 0) {
      setTabLayouts((prev) => {
        if (prev[tabId]?.x === x && prev[tabId]?.width === width) {
          return prev;
        }
        return { ...prev, [tabId]: { x, width } };
      });
    }
  };

  // Animate the pill whenever activeTab changes or layout measurements resolve
  useEffect(() => {
    const layout = tabLayouts[activeTab];
    const targetX = layout ? layout.x : activeIndex * estimatedTabWidth;
    const targetWidth = layout ? layout.width : estimatedTabWidth;

    const fromIndex = prevIndexRef.current;
    const distance = activeIndex - fromIndex;
    prevIndexRef.current = activeIndex;

    if (isFirstLayoutRef.current) {
      // First render: snap immediately to avoid a 0-to-target jump across the screen
      translateX.value = targetX;
      pillWidth.value = targetWidth;
      pillOpacity.value = withTiming(1, { duration: 200 });
      isFirstLayoutRef.current = false;
    } else {
      // Fluid Apple-style spring transit along the dock path
      translateX.value = withSpring(targetX, {
        damping: 19,
        stiffness: 190,
        mass: 0.82
      });

      pillWidth.value = withSpring(targetWidth, {
        damping: 19,
        stiffness: 190,
        mass: 0.82
      });

      // Liquid momentum stretch: slightly stretches during fast jumps, then snaps tight
      if (Math.abs(distance) > 0) {
        const stretchFactor = Math.min(1 + Math.abs(distance) * 0.05, 1.15);
        pillScaleX.value = withSequence(
          withTiming(stretchFactor, {
            duration: 120,
            easing: Easing.out(Easing.cubic)
          }),
          withSpring(1, {
            damping: 15,
            stiffness: 220
          })
        );
      }
    }
  }, [activeTab, activeIndex, tabLayouts]);

  const animatedPillStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { scaleX: pillScaleX.value }
      ],
      width: pillWidth.value > 0 ? pillWidth.value : estimatedTabWidth,
      opacity: pillOpacity.value
    };
  });

  return (
    <View
      style={[
        styles.floatingContainer,
        { bottom: Math.max(insets.bottom + 8, 16) }
      ]}
      pointerEvents="box-none"
    >
      <BlurView intensity={85} tint="dark" style={styles.pillBlur}>
        <View style={styles.tabsRow}>
          {/* Animated Liquid Sliding Pill (Renders underneath active tab content) */}
          <Animated.View
            style={[styles.slidingPill, animatedPillStyle]}
            pointerEvents="none"
          />

          {/* Tab Buttons */}
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <AnimatedTabButton
                key={tab.id}
                tab={tab}
                isActive={isActive}
                onPress={() => handleTabPress(tab.id)}
                onLayout={(e) => handleTabLayout(tab.id, e)}
              />
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 100
  },
  pillBlur: {
    width: '100%',
    maxWidth: 390,
    borderRadius: 9999,
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(28, 30, 26, 0.85)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative'
  },
  slidingPill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 9999,
    minHeight: 46,
    backgroundColor: 'transparent',
    zIndex: 2
  },
  tabPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.95 }]
  },
  tabContentInner: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  tabLabel: {
    fontSize: 9.5,
    marginTop: 2,
    letterSpacing: 0.2
  },
  tabLabelInactive: {
    color: 'rgba(255, 255, 255, 0.48)',
    fontWeight: '600',
    fontFamily: 'DMSans_500Medium'
  },
  tabLabelActive: {
    color: '#11120E',
    fontWeight: '700',
    fontFamily: 'DMSans_700Bold'
  }
});
