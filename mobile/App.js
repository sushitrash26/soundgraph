import React, { useEffect } from 'react';
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

import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Disc3, User } from 'lucide-react-native';
import { THEME } from './src/theme/theme';
import { useMobileStore } from './src/store/useMobileStore';
import { PORT, LAN_HOST_IP } from './src/api/config';

import { useState } from 'react';
import * as Font from 'expo-font';
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

  useEffect(() => {
    async function prepare() {
      try {
        await Font.loadAsync({
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
    const ok = await checkBackendConnection();
    if (ok) {
      const state = useMobileStore.getState();
      if (state.isAuthenticated && state.user && state.onboardingStep === 'auth') {
        state.setOnboardingStep('quiz');
      }
      await Promise.all([
        fetchPlatformData('youtube'),
        fetchPlatformData('spotify')
      ]);
    }
  };

  const renderActiveScreen = () => {
    if (!isAuthenticated || onboardingStep === 'auth') {
      return <LoginScreen />;
    }
    if (onboardingStep === 'quiz') {
      return <TasteQuizScreen />;
    }
    if (onboardingStep === 'first_deck' || onboardingStep === 'milestone') {
      return <FirstDeckScreen />;
    }

    return (
      <View style={styles.screenContainer}>
        {currentTab === 'recommendations' && <InfiniteDeckScreen />}
        {currentTab === 'lens' && <AcousticLensScreen />}
        {currentTab === 'migration' && <MigrationScreen />}
        {currentTab === 'profile' && <ProfileScreen />}
      </View>
    );
  };

  const isMainApp = isAuthenticated && onboardingStep !== 'auth' && onboardingStep !== 'quiz' && onboardingStep !== 'first_deck' && onboardingStep !== 'milestone';

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0E0C0B' }}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="light-content" backgroundColor="#0E0C0B" />
          {isMainApp && <AmbientGlassBackground />}

          {/* Active Screen Content */}
          {renderActiveScreen()}

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
            onRequestClose={closeAuthModal}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCardContainer}>
                <LoginScreen onClose={closeAuthModal} />
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0E0C0B'
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
