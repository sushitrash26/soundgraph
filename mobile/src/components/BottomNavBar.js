import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Compass, Layers, Radio, ShieldCheck } from 'lucide-react-native';
import { THEME } from '../theme/theme';
import { useMobileStore } from '../store/useMobileStore';

const TABS = [
  { key: 'deck', label: 'Curated Deck', icon: Compass },
  { key: 'hubs', label: 'Migration', icon: Layers },
  { key: 'lens', label: 'Acoustic Lens', icon: Radio },
  { key: 'vault', label: 'Vault', icon: ShieldCheck }
];

export default function BottomNavBar() {
  const { currentTab, setCurrentTab } = useMobileStore();

  const handleTabPress = (key) => {
    if (key === currentTab) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentTab(key);
  };

  return (
    <View style={styles.navWrapper}>
      <View style={styles.navBar}>
        {TABS.map((tab) => {
          const isActive = currentTab === tab.key;
          const Icon = tab.icon;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => handleTabPress(tab.key)}
            >
              <Icon
                size={20}
                color={isActive ? THEME.colors.textPrimary : THEME.colors.textMuted}
                strokeWidth={isActive ? 2.4 : 1.8}
              />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {isActive && <View style={styles.activePill} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navWrapper: {
    backgroundColor: THEME.colors.bg,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderSubtle,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 22
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: THEME.radius.md,
    position: 'relative'
  },
  tabButtonActive: {
    backgroundColor: THEME.colors.surfaceElevated
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: THEME.colors.textMuted,
    marginTop: 4
  },
  tabLabelActive: {
    color: THEME.colors.textPrimary,
    fontWeight: '700'
  },
  activePill: {
    position: 'absolute',
    top: 3,
    width: 14,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: THEME.colors.accent
  }
});
