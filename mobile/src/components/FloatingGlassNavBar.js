import React from 'react';
import { StyleSheet, View, Text, Pressable, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Home, Compass, ArrowLeftRight, User } from 'lucide-react-native';
import { useMobileStore } from '../store/useMobileStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TABS = [
  { id: 'recommendations', label: 'Home', icon: Home },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'migration', label: 'Move', icon: ArrowLeftRight },
  { id: 'profile', label: 'Profile', icon: User }
];

export default function FloatingGlassNavBar() {
  const { currentTab, setCurrentTab } = useMobileStore();

  const handleTabPress = (tabId) => {
    const targetTab = tabId === 'discover' ? 'recommendations' : tabId;
    if (currentTab !== targetTab) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentTab(targetTab);
    }
  };

  return (
    <View style={styles.floatingContainer} pointerEvents="box-none">
      <BlurView intensity={85} tint="dark" style={styles.pillBlur}>
        <View style={styles.tabsRow}>
          {TABS.map((tab) => {
            const isActive = tab.id === 'discover' ? false : currentTab === tab.id;
            const IconComponent = tab.icon;

            return (
              <Pressable
                key={tab.id}
                style={({ pressed }) => [
                  styles.tabButton,
                  isActive && styles.tabButtonActive,
                  pressed && styles.tabPressed
                ]}
                onPress={() => handleTabPress(tab.id)}
              >
                <IconComponent
                  size={18}
                  color={isActive ? '#11120E' : 'rgba(255, 255, 255, 0.45)'}
                  strokeWidth={isActive ? 2.4 : 1.9}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    isActive && styles.tabLabelActive
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
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
    justifyContent: 'space-between'
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 9999,
    minHeight: 46
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6
  },
  tabPressed: {
    opacity: 0.82
  },
  tabLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: 2,
    letterSpacing: 0.2,
    fontFamily: 'DMSans_500Medium'
  },
  tabLabelActive: {
    color: '#11120E',
    fontWeight: '700',
    fontFamily: 'DMSans_700Bold'
  }
});

