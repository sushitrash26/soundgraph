import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  StatusBar,
  Pressable,
  Image,
  Modal,
  LogBox
} from 'react-native';

LogBox.ignoreLogs([
  'Cannot connect to Expo CLI',
  'SafeAreaView has been deprecated'
]);

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  FadeInRight,
  FadeInLeft,
  FadeOutLeft,
  FadeOutRight
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Disc3, User } from 'lucide-react-native';
import { THEME } from './src/theme/theme';
import { useMobileStore } from './src/store/useMobileStore';
import { loadAsync } from 'expo-font';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold
} from '@expo-google-fonts/dm-sans';

// Screens & Components
import LoginScreen from './src/screens/LoginScreen';
import TasteQuizScreen from './src/screens/TasteQuizScreen';
import FirstDeckScreen from './src/screens/FirstDeckScreen';
import InfiniteDeckScreen from './src/screens/InfiniteDeckScreen';
import AcousticLensScreen from './src/screens/AcousticLensScreen';
import MigrationScreen from './src/screens/MigrationScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import FloatingGlassNavBar from './src/components/FloatingGlassNavBar';
import AmbientGlassBackground from './src/components/AmbientGlassBackground';

const TAB_ORDER = ['recommendations', 'lens', 'migration', 'profile'];

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  const {
    user,
    isAuthenticated,
    backendConnected,
    checkBackendConnection,
    fetchInfiniteDeck,
    fetchPlatformData,
    onboardingStep,
    currentTab,
    isAuthModalOpen,
    openAuthModal,
    closeAuthModal
  } = useMobileStore();

  const prevTabRef = useRef(currentTab);
  const [navDirection, setNavDirection] = useState('forward'); // 'forward' | 'backward'

  useEffect(() => {
    const prevIdx = TAB_ORDER.indexOf(prevTabRef.current);
    const currIdx = TAB_ORDER.indexOf(currentTab);
    if (currIdx !== prevIdx && prevIdx >= 0 && currIdx >= 0) {
      setNavDirection(currIdx > prevIdx ? 'forward' : 'backward');
      prevTabRef.current = currentTab;
    }
  }, [currentTab]);

  useEffect(() => {
    async function prepare() {
      try {
        await loadAsync({
          DMSans_400Regular,
          DMSans_500Medium,
          DMSans_600SemiBold,
          DMSans_700Bold
        });
      } catch (e) {
        console.warn('Font load error:', e);
      } finally {
        setFontsLoaded(true);
      }
      init();
    }
    prepare();
  }, []);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#0E0C0B' }} />;
  }

  const init = async () => {
    try {
      const ok = await checkBackendConnection();
      if (ok) {
        const state = useMobileStore.getState();
        if (state.isAuthenticated && state.user && state.onboardingStep === 'auth') {
          state.setOnboardingStep('quiz');
        }
        if (state.fetchPlatformData) {
          await Promise.allSettled([
            state.fetchPlatformData('youtube'),
            state.fetchPlatformData('spotify')
          ]);
        }
      }
    } catch (err) {
      console.warn('App init exception:', err);
    }
  };

  const renderActiveScreen = () => {
    if (!isAuthenticated || onboardingStep === 'auth') {
      return (
        <Animated.View key="auth" style={styles.screenContainer} entering={FadeIn.duration(250)} exiting={FadeOutLeft.duration(200)}>
          <LoginScreen />
        </Animated.View>
      );
    }
    if (onboardingStep === 'quiz') {
      return (
        <Animated.View key="quiz" style={styles.screenContainer} entering={FadeInRight.duration(280).springify().damping(19)} exiting={FadeOutLeft.duration(200)}>
          <TasteQuizScreen />
        </Animated.View>
      );
    }
    if (onboardingStep === 'first_deck' || onboardingStep === 'milestone') {
      return (
        <Animated.View key="first_deck" style={styles.screenContainer} entering={FadeInRight.duration(280).springify().damping(19)} exiting={FadeOut.duration(200)}>
          <FirstDeckScreen />
        </Animated.View>
      );
    }

    const enterAnim = navDirection === 'forward'
      ? FadeInRight.duration(260).springify().damping(19).stiffness(190)
      : FadeInLeft.duration(260).springify().damping(19).stiffness(190);

    const exitAnim = navDirection === 'forward'
      ? FadeOutLeft.duration(180)
      : FadeOutRight.duration(180);

    return (
      <View style={styles.screenContainer}>
        {currentTab === 'recommendations' && (
          <Animated.View
            key="recommendations"
            style={StyleSheet.absoluteFillObject}
            entering={enterAnim}
            exiting={exitAnim}
          >
            <InfiniteDeckScreen />
          </Animated.View>
        )}
        {currentTab === 'lens' && (
          <Animated.View
            key="lens"
            style={StyleSheet.absoluteFillObject}
            entering={enterAnim}
            exiting={exitAnim}
          >
            <AcousticLensScreen />
          </Animated.View>
        )}
        {currentTab === 'migration' && (
          <Animated.View
            key="migration"
            style={StyleSheet.absoluteFillObject}
            entering={enterAnim}
            exiting={exitAnim}
          >
            <MigrationScreen />
          </Animated.View>
        )}
        {currentTab === 'profile' && (
          <Animated.View
            key="profile"
            style={StyleSheet.absoluteFillObject}
            entering={enterAnim}
            exiting={exitAnim}
          >
            <ProfileScreen />
          </Animated.View>
        )}
      </View>
    );
  };

  const isMainApp = isAuthenticated && onboardingStep !== 'auth' && onboardingStep !== 'quiz' && onboardingStep !== 'first_deck' && onboardingStep !== 'milestone';

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0E0C0B' }}>
      <SafeAreaProvider>
        <View style={styles.rootContainer}>
          <StatusBar barStyle="light-content" translucent={true} backgroundColor="transparent" />
          <AmbientGlassBackground />

          {/* Active Screen Content */}
          <View style={styles.screenContainer}>
            {renderActiveScreen()}
          </View>

          {/* Bottom Floating Glass Nav Bar for Main App */}
          {isMainApp && (
            <FloatingGlassNavBar
              currentTab={currentTab}
              onSelectTab={(tab) => {
                Haptics.selectionAsync();
                useMobileStore.getState().setCurrentTab(tab);
              }}
            />
          )}

          {/* User Profile & Auth Modal */}
          <Modal
            visible={isAuthModalOpen}
            animationType="slide"
            transparent={true}
            statusBarTranslucent={true}
            onRequestClose={closeAuthModal}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCardContainer}>
                <LoginScreen onClose={closeAuthModal} />
              </View>
            </View>
          </Modal>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#0E0C0B',
    overflow: 'hidden'
  },
  screenContainer: {
    flex: 1
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalCardContainer: {
    width: '100%',
    height: '100%'
  }
});
