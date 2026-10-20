import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import {
  Moon,
  Zap,
  Heart,
  Sun,
  Lock,
  Sliders,
  Compass,
  MicOff,
  Radio,
  VolumeX,
  Music,
  CheckCircle2,
  ArrowRight,
  ArrowLeft
} from 'lucide-react-native';
import { THEME } from '../theme/theme';
import { useMobileStore } from '../store/useMobileStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AmbientGlassBackground from '../components/AmbientGlassBackground';
import Animated, { FadeInRight } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const QUESTIONS = [
  {
    id: 'routine',
    step: 1,
    title: 'When are your headphones on the most?',
    subtitle: 'This anchors your acoustic baseline and tempo preference.',
    options: [
      { id: 'late_night', label: 'Late night focus', icon: Moon },
      { id: 'workout', label: 'Workout & energy', icon: Zap },
      { id: 'feelings', label: 'In my feelings', icon: Heart },
      { id: 'good_vibes', label: 'Good vibes & daytime', icon: Sun }
    ]
  },
  {
    id: 'discovery',
    step: 2,
    title: 'What kind of mix do you want?',
    subtitle: 'Determines how far our graph explores outside your familiar tracks.',
    options: [
      { id: 'familiar', label: 'Stick to what I know', icon: Lock, hint: 'High-confidence comfort tracks' },
      { id: 'balanced', label: 'A good balance', icon: Sliders, hint: '70% familiar, 30% sonic discovery' },
      { id: 'adventurous', label: 'Surprise me', icon: Compass, hint: 'Deep-cut global exploration' }
    ]
  },
  {
    id: 'dealbreakers',
    step: 3,
    title: 'What makes you hit skip immediately?',
    subtitle: 'Select any hard filters. (You can select multiple or none)',
    isMultiSelect: true,
    options: [
      { id: 'heavy_autotune', label: 'Heavy autotune', icon: MicOff },
      { id: 'generic_pop', label: 'Generic radio pop', icon: Radio },
      { id: 'screaming_distortion', label: 'Screaming distortion', icon: VolumeX },
      { id: 'acoustic_ballads', label: 'Slow acoustic ballads', icon: Music },
      { id: 'none', label: "None, I'm open to anything", icon: CheckCircle2 }
    ]
  }
];

export default function TasteQuizScreen() {
  const insets = useSafeAreaInsets();
  const {
    submitVibeQuiz,
    isLoadingFirstDeck,
    firstDeckError
  } = useMobileStore();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedRoutine, setSelectedRoutine] = useState('late_night');
  const [selectedDiscovery, setSelectedDiscovery] = useState('balanced');
  const [selectedDealbreakers, setSelectedDealbreakers] = useState([]);

  const currentQuestion = QUESTIONS[currentStepIndex];

  const handleSelectOption = (optionId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (currentQuestion.id === 'routine') {
      setSelectedRoutine(optionId);
    } else if (currentQuestion.id === 'discovery') {
      setSelectedDiscovery(optionId);
    } else if (currentQuestion.id === 'dealbreakers') {
      if (optionId === 'none') {
        setSelectedDealbreakers(['none']);
        return;
      }
      setSelectedDealbreakers((prev) => {
        const withoutNone = prev.filter((id) => id !== 'none');
        if (withoutNone.includes(optionId)) {
          return withoutNone.filter((id) => id !== optionId);
        } else {
          return [...withoutNone, optionId];
        }
      });
    }
  };

  const isOptionSelected = (optionId) => {
    if (currentQuestion.id === 'routine') return selectedRoutine === optionId;
    if (currentQuestion.id === 'discovery') return selectedDiscovery === optionId;
    if (currentQuestion.id === 'dealbreakers') return selectedDealbreakers.includes(optionId);
    return false;
  };

  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (currentStepIndex < QUESTIONS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      await submitVibeQuiz(
        selectedRoutine,
        selectedDiscovery,
        selectedDealbreakers.filter((id) => id !== 'none')
      );
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  if (isLoadingFirstDeck) {
    return (
      <View style={styles.loadingContainer}>
        <AmbientGlassBackground />
        <View style={styles.loadingCard}>
          <BlurView intensity={75} tint="light" style={styles.loadingBlur}>
            <ActivityIndicator size="large" color="#FFFFFF" style={{ marginBottom: 16 }} />
            <Text style={styles.loadingHeadline}>Curating Your 5 Songs</Text>
            <Text style={styles.loadingSubtitle}>
              Synthesizing your library with {selectedRoutine.replace('_', ' ')} routine and discovery profile...
            </Text>
          </BlurView>
        </View>
      </View>
    );
  }

  return (
    <View style={[
      styles.container,
      {
        paddingTop: Math.max(insets.top + 6, 16),
        paddingBottom: Math.max(insets.bottom + 16, 24)
      }
    ]}>
      <AmbientGlassBackground />

      {/* Top Header & Reference-Image Style Pill Switcher */}
      <View style={styles.topHeader}>
        <View style={styles.navRow}>
          {currentStepIndex > 0 ? (
            <Pressable style={styles.backButton} onPress={handleBack}>
              <BlurView intensity={70} tint="light" style={styles.backBlur}>
                <ArrowLeft size={16} color="#FFFFFF" />
              </BlurView>
            </Pressable>
          ) : (
            <View style={{ width: 38 }} />
          )}

          {/* Reference Image Style Top Switcher [ Step 1 ] [ Step 2 ] [ Step 3 ] */}
          <View style={styles.stepPillGroup}>
            {[0, 1, 2].map((idx) => {
              const isActive = idx === currentStepIndex;
              return (
                <Pressable
                  key={idx}
                  style={[
                    styles.stepPill,
                    isActive ? styles.stepPillActive : styles.stepPillInactive
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setCurrentStepIndex(idx);
                  }}
                >
                  <Text
                    style={[
                      styles.stepPillText,
                      isActive ? styles.stepPillTextActive : styles.stepPillTextInactive
                    ]}
                  >
                    Question {idx + 1}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ width: 38 }} />
        </View>
      </View>

      {/* Animated Step Content (Question + Options) */}
      <Animated.View
        key={currentQuestion.id}
        style={{ width: '100%' }}
        entering={FadeInRight.duration(240).springify().damping(18)}
      >
        {/* Main Question & Subtitle */}
        <View style={styles.questionSection}>
          <Text style={styles.questionTitle}>{currentQuestion.title}</Text>
          <Text style={styles.questionSubtitle}>{currentQuestion.subtitle}</Text>
        </View>

        {/* Translucent Frosted Glass Option Tiles */}
        <View style={styles.optionsList}>
          {currentQuestion.options.map((option) => {
            const selected = isOptionSelected(option.id);
            const IconComponent = option.icon;

            return (
              <Pressable
                key={option.id}
                style={({ pressed }) => [
                  styles.optionTile,
                  selected && styles.optionTileSelected,
                  pressed && styles.tilePressed
                ]}
                onPress={() => handleSelectOption(option.id)}
              >
                <BlurView
                  intensity={selected ? 85 : 65}
                  tint="light"
                  style={[
                    styles.optionBlur,
                    selected && styles.optionBlurSelected
                  ]}
                >
                  <View style={styles.optionRow}>
                    <View
                      style={[
                        styles.iconCircle,
                        selected && styles.iconCircleSelected
                      ]}
                    >
                      <IconComponent
                        size={20}
                        color={selected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.75)'}
                        strokeWidth={2}
                      />
                    </View>

                    <View style={styles.optionContentCol}>
                      <Text
                        style={[
                          styles.optionLabel,
                          selected && styles.optionLabelSelected
                        ]}
                      >
                        {option.label}
                      </Text>
                      {option.hint && (
                        <Text style={styles.optionHint}>{option.hint}</Text>
                      )}
                    </View>

                    {selected && (
                      <View style={styles.checkIndicator}>
                        <CheckCircle2 size={19} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                </BlurView>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      {/* Bottom Solid White Action Button */}
      <View style={styles.bottomSection}>
        <Pressable
          style={({ pressed }) => [
            styles.solidWhiteButton,
            pressed && styles.tilePressed
          ]}
          onPress={handleNext}
        >
          <Text style={styles.solidWhiteButtonText}>
            {currentStepIndex === QUESTIONS.length - 1
              ? 'Curate My First 5 Songs'
              : 'Next Question'}
          </Text>
          <ArrowRight size={17} color="#181716" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 24
  },
  topHeader: {
    marginBottom: 12
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  backButton: {
    borderRadius: 19,
    overflow: 'hidden'
  },
  backBlur: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.28)'
  },
  stepPillGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 9999,
    padding: 3,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.22)'
  },
  stepPill: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 9999
  },
  stepPillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8
  },
  stepPillInactive: {
    backgroundColor: 'transparent'
  },
  stepPillText: {
    fontSize: 12,
    fontWeight: '700'
  },
  stepPillTextActive: {
    color: '#181716'
  },
  stepPillTextInactive: {
    color: 'rgba(255, 255, 255, 0.65)'
  },
  questionSection: {
    marginBottom: 16
  },
  questionTitle: {
    fontSize: 25,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    lineHeight: 33,
    marginBottom: 8
  },
  questionSubtitle: {
    fontSize: 13.5,
    color: 'rgba(255, 255, 255, 0.68)',
    lineHeight: 20
  },
  optionsList: {
    flex: 1,
    gap: 11,
    justifyContent: 'center'
  },
  optionTile: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16
  },
  optionTileSelected: {
    borderColor: 'rgba(255, 255, 255, 0.55)',
    shadowOpacity: 0.25
  },
  tilePressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }]
  },
  optionBlur: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)'
  },
  optionBlurSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.24)'
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)'
  },
  iconCircleSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    borderColor: '#FFFFFF'
  },
  optionContentCol: {
    flex: 1
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)'
  },
  optionLabelSelected: {
    color: '#FFFFFF'
  },
  optionHint: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.55)',
    marginTop: 2
  },
  checkIndicator: {
    marginLeft: 8
  },
  bottomSection: {
    paddingTop: 12
  },
  solidWhiteButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 9999,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 18
  },
  solidWhiteButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#181716'
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0E0C0B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28
  },
  loadingCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.28)'
  },
  loadingBlur: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)'
  },
  loadingHeadline: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center'
  },
  loadingSubtitle: {
    fontSize: 13.5,
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
    lineHeight: 20
  }
});
