import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Modal,
  Dimensions
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import {
  Sparkles,
  User,
  ArrowLeftRight,
  Radio,
  CheckCircle2,
  ArrowRight
} from 'lucide-react-native';
import { THEME } from '../theme/theme';
import { useMobileStore } from '../store/useMobileStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OnboardingMilestoneModal({ visible }) {
  const {
    onboardingMilestoneData,
    completeOnboarding
  } = useMobileStore();

  const handleSelectPath = (tabKey) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    completeOnboarding(tabKey);
  };

  const archetype = onboardingMilestoneData?.archetype || 'Late-Night Introspective';
  const alpha = onboardingMilestoneData?.calibrated_alpha ?? 0.50;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCardWrapper}>
          <BlurView intensity={85} tint="light" style={styles.modalCardBlur}>
            {/* Success Icon Ring */}
            <View style={styles.iconRingContainer}>
              <View style={styles.iconInner}>
                <CheckCircle2 size={32} color="#FFFFFF" strokeWidth={2.4} />
              </View>
            </View>

            {/* Headline & Archetype Badge */}
            <Text style={styles.milestoneTag}>5 OF 5 RATED</Text>
            <Text style={styles.milestoneTitle}>Taste DNA Calibrated</Text>
            <Text style={styles.milestoneDescription}>
              Your latent preference matrix has fused with live acoustic graphs.
            </Text>

            {/* Translucent Archetype Pill */}
            <View style={styles.archetypePill}>
              <Sparkles size={14} color="#F59E0B" />
              <Text style={styles.archetypeText}>{archetype}</Text>
              <Text style={styles.alphaText}>α = {alpha.toFixed(2)}</Text>
            </View>

            <Text style={styles.guidancePrompt}>WHERE TO EXPLORE FIRST?</Text>

            <View style={styles.pathsContainer}>
              {/* Path 1: Profile */}
              <Pressable
                style={({ pressed }) => [
                  styles.pathTile,
                  pressed && styles.tilePressed
                ]}
                onPress={() => handleSelectPath('profile')}
              >
                <BlurView intensity={65} tint="light" style={styles.pathTileBlur}>
                  <View style={styles.pathIconCircle}>
                    <User size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.pathTextCol}>
                    <Text style={styles.pathTitle}>My Taste Profile</Text>
                    <Text style={styles.pathSub}>View your acoustic archetype & DNA spectrum</Text>
                  </View>
                  <ArrowRight size={16} color="rgba(255, 255, 255, 0.65)" />
                </BlurView>
              </Pressable>

              {/* Path 2: Migration */}
              <Pressable
                style={({ pressed }) => [
                  styles.pathTile,
                  pressed && styles.tilePressed
                ]}
                onPress={() => handleSelectPath('migration')}
              >
                <BlurView intensity={65} tint="light" style={styles.pathTileBlur}>
                  <View style={styles.pathIconCircle}>
                    <ArrowLeftRight size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.pathTextCol}>
                    <Text style={styles.pathTitle}>Cross-Platform Migration</Text>
                    <Text style={styles.pathSub}>Transfer Spotify & YouTube playlists</Text>
                  </View>
                  <ArrowRight size={16} color="rgba(255, 255, 255, 0.65)" />
                </BlurView>
              </Pressable>

              {/* Path 3: Solid White Primary Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.solidWhitePathButton,
                  pressed && styles.tilePressed
                ]}
                onPress={() => handleSelectPath('recommendations')}
              >
                <Radio size={17} color="#181716" />
                <Text style={styles.solidWhitePathText}>Start Infinite Discovery Feed</Text>
                <ArrowRight size={16} color="#181716" />
              </Pressable>
            </View>
          </BlurView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.70)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20
  },
  modalCardWrapper: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.4,
    shadowRadius: 32
  },
  modalCardBlur: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(30, 24, 20, 0.90)'
  },
  iconRingContainer: {
    marginBottom: 16
  },
  iconInner: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.35)'
  },
  milestoneTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.2,
    marginBottom: 4
  },
  milestoneTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    marginBottom: 8,
    textAlign: 'center'
  },
  milestoneDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 8
  },
  archetypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 9999,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: 20
  },
  archetypeText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  alphaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  guidancePrompt: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.55)',
    letterSpacing: 1,
    alignSelf: 'flex-start',
    marginBottom: 10
  },
  pathsContainer: {
    width: '100%',
    gap: 10
  },
  pathTile: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.22)'
  },
  pathTileBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.10)'
  },
  tilePressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }]
  },
  pathIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)'
  },
  pathTextCol: {
    flex: 1
  },
  pathTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  pathSub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.55)',
    marginTop: 1
  },
  solidWhitePathButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 9999,
    gap: 8,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12
  },
  solidWhitePathText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#181716'
  }
});
