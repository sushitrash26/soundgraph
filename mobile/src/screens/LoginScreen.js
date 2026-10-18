import React from 'react';
import { StyleSheet, View, Text, Pressable, Image, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Music, Check, ArrowRight, ShieldCheck, Sparkles, X } from 'lucide-react-native';
import { THEME } from '../theme/theme';
import { useMobileStore } from '../store/useMobileStore';
import Sparkler3D from '../components/Sparkler3D';

export default function LoginScreen({ onClose }) {
  const {
    user,
    authStatus,
    isAuthenticated,
    loginWithGoogle,
    loginWithSpotify,
    loginAsGuest,
    logoutUser,
    setCurrentTab
  } = useMobileStore();

  const handleEnterVault = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (onClose) onClose();
    setCurrentTab('deck');
  };

  const isGoogleConnected = authStatus?.google_connected || !!user;
  const isSpotifyConnected = authStatus?.spotify_connected;

  return (
    <View style={styles.container}>
      {/* 3D Background Moving Sparklers */}
      <View style={styles.sparklerWrapper}>
        <Sparkler3D width={360} height={360} accentColor="#A855F7" />
      </View>

      {/* Dismiss Button if opened as modal */}
      {onClose && (
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <X size={20} color={THEME.colors.textSecondary} />
        </Pressable>
      )}

      {/* Brand Header */}
      <View style={styles.brandContainer}>
        <LinearGradient
          colors={['#A855F7', '#6366F1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logoBadge}
        >
          <Music size={28} color="#FFFFFF" />
        </LinearGradient>
        <Text style={styles.brandTitle}>SOUNDGRAPH</Text>
        <Text style={styles.brandTagline}>
          Multi-Platform Latent Graph & Personal Discovery
        </Text>
      </View>

      {/* Authenticated User Card if already connected */}
      {isAuthenticated && user && (
        <View style={styles.activeSessionCard}>
          <View style={styles.userProfileRow}>
            {user.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.userAvatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>{user.name ? user.name[0] : 'U'}</Text>
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={styles.badgeRow}>
                <ShieldCheck size={14} color="#22C55E" />
                <Text style={styles.sessionStatus}>ACTIVE SESSION</Text>
              </View>
              <Text style={styles.userName} numberOfLines={1}>{user.name || 'Sushitrash'}</Text>
              <Text style={styles.userSub} numberOfLines={1}>{user.id}</Text>
            </View>
          </View>

          {/* Connected Provider Pills */}
          <View style={styles.providersRow}>
            <View style={[styles.providerPill, isGoogleConnected && styles.providerPillActive]}>
              <View style={[styles.statusDot, { backgroundColor: isGoogleConnected ? '#EF4444' : '#666' }]} />
              <Text style={styles.providerText}>Google / YouTube Music</Text>
              {isGoogleConnected && <Check size={12} color="#22C55E" style={{ marginLeft: 4 }} />}
            </View>

            <View style={[styles.providerPill, isSpotifyConnected && styles.providerPillActive]}>
              <View style={[styles.statusDot, { backgroundColor: isSpotifyConnected ? '#1DB954' : '#666' }]} />
              <Text style={styles.providerText}>Spotify</Text>
              {isSpotifyConnected && <Check size={12} color="#22C55E" style={{ marginLeft: 4 }} />}
            </View>
          </View>

          {/* Primary 1-Tap Enter Button */}
          <Pressable style={styles.enterVaultBtn} onPress={handleEnterVault}>
            <LinearGradient
              colors={['#A855F7', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.enterVaultGradient}
            >
              <Sparkles size={16} color="#FFFFFF" />
              <Text style={styles.enterVaultText}>Enter Curated Deck</Text>
              <ArrowRight size={16} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
        </View>
      )}

      {/* OAuth Actions */}
      <View style={styles.actionsContainer}>
        <Text style={styles.sectionLabel}>
          {isAuthenticated ? 'LINK OR SWITCH ACCOUNTS' : 'CONNECT YOUR STREAMING VAULT'}
        </Text>

        {/* Google / YouTube Login */}
        <Pressable
          style={[styles.oauthBtn, styles.googleBtn]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            loginWithGoogle();
          }}
        >
          <View style={[styles.providerIconCircle, { backgroundColor: '#EF4444' }]}>
            <Text style={styles.providerIconText}>G</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.oauthBtnTitle}>
              {isGoogleConnected ? 'Reconnect Google Account' : 'Connect Google / YouTube'}
            </Text>
            <Text style={styles.oauthBtnSubtitle}>Sync YouTube Music likes & playlists</Text>
          </View>
          {isGoogleConnected && <Check size={16} color="#22C55E" />}
        </Pressable>

        {/* Spotify Login */}
        <Pressable
          style={[styles.oauthBtn, styles.spotifyBtn]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            loginWithSpotify();
          }}
        >
          <View style={[styles.providerIconCircle, { backgroundColor: '#1DB954' }]}>
            <Music size={14} color="#000" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.oauthBtnTitle}>
              {isSpotifyConnected ? 'Reconnect Spotify' : 'Connect Spotify Account'}
            </Text>
            <Text style={styles.oauthBtnSubtitle}>Link library & playlists for 1-click sync</Text>
          </View>
          {isSpotifyConnected && <Check size={16} color="#22C55E" />}
        </Pressable>

        {/* Guest Explorer */}
        {!isAuthenticated && (
          <Pressable
            style={styles.guestBtn}
            onPress={() => {
              Haptics.selectionAsync();
              loginAsGuest();
            }}
          >
            <Text style={styles.guestBtnText}>Explore as Guest Explorer</Text>
          </Pressable>
        )}

        {isAuthenticated && (
          <Pressable
            style={styles.logoutBtn}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              logoutUser();
            }}
          >
            <Text style={styles.logoutBtnText}>Log Out Session</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
    justifyContent: 'center',
    paddingHorizontal: 24,
    position: 'relative'
  },
  sparklerWrapper: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    opacity: 0.65
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 28,
    zIndex: 2
  },
  logoBadge: {
    width: 58,
    height: 58,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
    letterSpacing: 2.5
  },
  brandTagline: {
    fontSize: 12.5,
    color: THEME.colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18
  },
  activeSessionCard: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderActive,
    borderRadius: THEME.radius.lg,
    padding: 16,
    marginBottom: 22,
    zIndex: 2
  },
  userProfileRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700'
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  sessionStatus: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#22C55E',
    letterSpacing: 0.8
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginTop: 2
  },
  userSub: {
    fontSize: 11,
    color: THEME.colors.textMuted
  },
  providersRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderSubtle
  },
  providerPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: THEME.radius.sm
  },
  providerPillActive: {
    borderColor: THEME.colors.borderActive,
    borderWidth: 1
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6
  },
  providerText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontWeight: '600'
  },
  enterVaultBtn: {
    marginTop: 14,
    borderRadius: THEME.radius.md,
    overflow: 'hidden'
  },
  enterVaultGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12
  },
  enterVaultText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  actionsContainer: {
    gap: 12,
    zIndex: 2
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 1,
    marginBottom: 4
  },
  oauthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    borderRadius: THEME.radius.lg,
    padding: 14
  },
  googleBtn: {
    borderColor: 'rgba(239, 68, 68, 0.25)'
  },
  spotifyBtn: {
    borderColor: 'rgba(29, 185, 84, 0.25)'
  },
  providerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  providerIconText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800'
  },
  oauthBtnTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: THEME.colors.textPrimary
  },
  oauthBtnSubtitle: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 2
  },
  guestBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4
  },
  guestBtnText: {
    color: THEME.colors.textSecondary,
    fontSize: 12.5,
    fontWeight: '600',
    textDecorationLine: 'underline'
  },
  logoutBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4
  },
  logoutBtnText: {
    color: THEME.colors.danger,
    fontSize: 12,
    fontWeight: '600'
  }
});
