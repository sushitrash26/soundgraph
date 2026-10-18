import React, { useEffect, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Music, User, Wifi } from 'lucide-react-native';
import { THEME } from './src/theme/theme';
import { useMobileStore } from './src/store/useMobileStore';
import { LOCAL_HOST_IP, PORT } from './src/api/config';

// Screens & Navigation
import CuratedDeckScreen from './src/screens/CuratedDeckScreen';
import HubsScreen from './src/screens/HubsScreen';
import AcousticLensScreen from './src/screens/AcousticLensScreen';
import VaultScreen from './src/screens/VaultScreen';
import LoginScreen from './src/screens/LoginScreen';
import BottomNavBar from './src/components/BottomNavBar';

export default function App() {
  const {
    user,
    isAuthenticated,
    backendConnected,
    isConnecting,
    checkBackendConnection,
    fetchCuratedDeck,
    fetchPlatformData,
    fetchUserDecks,
    currentTab,
    isAuthModalOpen,
    openAuthModal,
    closeAuthModal
  } = useMobileStore();

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const ok = await checkBackendConnection();
    if (ok) {
      await Promise.all([
        fetchCuratedDeck(),
        fetchPlatformData('youtube'),
        fetchPlatformData('spotify'),
        fetchUserDecks()
      ]);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={THEME.colors.bg} />

      {/* Top Application Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LinearGradient
            colors={['#A855F7', '#6366F1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoBadge}
          >
            <Music size={16} color="#FFFFFF" />
          </LinearGradient>
          <View>
            <Text style={styles.brandTitle}>SoundGraph</Text>
            <View style={styles.connectionRow}>
              <View
                style={[
                  styles.connectionDot,
                  { backgroundColor: backendConnected ? '#22C55E' : '#EF4444' }
                ]}
              />
              <Text style={styles.connectionText}>
                {backendConnected ? `Connected (${LOCAL_HOST_IP}:${PORT})` : 'Connecting to PC...'}
              </Text>
            </View>
          </View>
        </View>

        {/* User Vault Pill Trigger */}
        <Pressable
          style={styles.userButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            openAuthModal();
          }}
        >
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.userAvatar} />
          ) : (
            <View style={styles.userAvatarFallback}>
              <Text style={styles.avatarLetter}>{user?.name ? user.name[0] : 'U'}</Text>
            </View>
          )}
          <Text style={styles.userNameText} numberOfLines={1}>
            {user?.name || (isAuthenticated ? 'Active User' : 'Sign In')}
          </Text>
        </Pressable>
      </View>

      {/* Main Tab Screen Content */}
      <View style={styles.screenContainer}>
        {currentTab === 'deck' && <CuratedDeckScreen />}
        {currentTab === 'hubs' && <HubsScreen />}
        {currentTab === 'lens' && <AcousticLensScreen />}
        {currentTab === 'vault' && <VaultScreen onOpenAuth={openAuthModal} />}
      </View>

      {/* Fixed Bottom Navigation Bar */}
      <BottomNavBar />

      {/* Luxury Authentication Modal */}
      <Modal
        visible={isAuthModalOpen || (!isAuthenticated && !isConnecting)}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (isAuthenticated) closeAuthModal();
        }}
      >
        <LoginScreen onClose={isAuthenticated ? closeAuthModal : null} />
      </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.bg
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderSubtle,
    backgroundColor: THEME.colors.bg
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
    letterSpacing: 0.5
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2
  },
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5
  },
  connectionText: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    fontWeight: '600'
  },
  userButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle
  },
  userAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6
  },
  userAvatarFallback: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: THEME.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6
  },
  avatarLetter: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800'
  },
  userNameText: {
    color: THEME.colors.textPrimary,
    fontSize: 11.5,
    fontWeight: '700',
    maxWidth: 80
  },
  screenContainer: {
    flex: 1,
    backgroundColor: THEME.colors.bg
  }
});
