import React from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, Image } from 'react-native';
import * as Haptics from 'expo-haptics';
import { 
  ShieldCheck, 
  Database, 
  Wifi, 
  RotateCcw, 
  LogOut, 
  ChevronRight, 
  Tv, 
  Music,
  UserCheck
} from 'lucide-react-native';
import { THEME } from '../theme/theme';
import { useMobileStore } from '../store/useMobileStore';
import { LOCAL_HOST_IP, PORT } from '../api/config';

export default function VaultScreen({ onOpenAuth }) {
  const {
    user,
    authStatus,
    logoutUser,
    checkBackendConnection,
    fetchPlatformData,
    fetchCuratedDeck,
    youtubeProfile,
    spotifyProfile
  } = useMobileStore();

  const handleRefreshAll = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Promise.all([
      checkBackendConnection(),
      fetchPlatformData('youtube'),
      fetchPlatformData('spotify'),
      fetchCuratedDeck()
    ]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const isGoogleConnected = authStatus?.google_connected || !!user;
  const isSpotifyConnected = authStatus?.spotify_connected;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User Header */}
      <View style={styles.userCard}>
        {user?.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarText}>{user?.name ? user.name[0] : 'U'}</Text>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.userName}>{user?.name || 'Explorer'}</Text>
          <Text style={styles.userId} numberOfLines={1}>{user?.id || 'demo_user'}</Text>
          <View style={styles.verifiedRow}>
            <ShieldCheck size={13} color="#22C55E" />
            <Text style={styles.verifiedText}>AUTHENTICATED VAULT</Text>
          </View>
        </View>
      </View>

      {/* Neo4j Graph Statistics */}
      <Text style={styles.sectionTitle}>NEO4J KNOWLEDGE GRAPH METRICS</Text>
      <View style={styles.statsCard}>
        <View style={styles.statRow}>
          <Database size={16} color={THEME.colors.accent} />
          <Text style={styles.statLabel}>YouTube Music Nodes</Text>
          <Text style={styles.statValue}>{youtubeProfile?.total_tracks || 162} Tracks</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statRow}>
          <Database size={16} color="#1DB954" />
          <Text style={styles.statLabel}>Spotify Library Nodes</Text>
          <Text style={styles.statValue}>{spotifyProfile?.total_tracks || 6} Tracks</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statRow}>
          <Database size={16} color="#38BDF8" />
          <Text style={styles.statLabel}>Latent Genre Vectors</Text>
          <Text style={styles.statValue}>18 Clusters Active</Text>
        </View>
      </View>

      {/* Linked Accounts */}
      <Text style={styles.sectionTitle}>LINKED STREAMING ACCOUNTS</Text>
      <View style={styles.accountsCard}>
        <Pressable style={styles.accountRow} onPress={onOpenAuth}>
          <Tv size={18} color="#EF4444" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.accountName}>Google / YouTube Music</Text>
            <Text style={styles.accountSub}>{isGoogleConnected ? 'Syncing Active' : 'Not Linked'}</Text>
          </View>
          <ChevronRight size={16} color={THEME.colors.textMuted} />
        </Pressable>

        <View style={styles.statDivider} />

        <Pressable style={styles.accountRow} onPress={onOpenAuth}>
          <Music size={18} color="#1DB954" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.accountName}>Spotify Platform</Text>
            <Text style={styles.accountSub}>{isSpotifyConnected ? 'Syncing Active' : 'Not Linked'}</Text>
          </View>
          <ChevronRight size={16} color={THEME.colors.textMuted} />
        </Pressable>
      </View>

      {/* Network & Local Host Diagnostics */}
      <Text style={styles.sectionTitle}>NETWORK & SYSTEM DIAGNOSTICS</Text>
      <View style={styles.diagCard}>
        <View style={styles.diagRow}>
          <Wifi size={15} color="#22C55E" />
          <Text style={styles.diagLabel}>FastAPI LAN Gateway</Text>
          <Text style={styles.diagValue}>{LOCAL_HOST_IP}:{PORT}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.diagRow}>
          <Wifi size={15} color="#38BDF8" />
          <Text style={styles.diagLabel}>Metro Bundler Runtime</Text>
          <Text style={styles.diagValue}>Expo SDK 57 (0.86)</Text>
        </View>
      </View>

      {/* System Actions */}
      <View style={styles.systemActions}>
        <Pressable style={styles.refreshBtn} onPress={handleRefreshAll}>
          <RotateCcw size={15} color="#FFF" />
          <Text style={styles.refreshBtnText}>Synchronize All Graph Data</Text>
        </Pressable>

        <Pressable
          style={styles.logoutBtn}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            logoutUser();
          }}
        >
          <LogOut size={15} color={THEME.colors.danger} />
          <Text style={styles.logoutBtnText}>Log Out Session & Switch Account</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    padding: 20,
    paddingBottom: 40
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    padding: 16,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    marginBottom: 24
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: THEME.colors.accent,
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF'
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary
  },
  userId: {
    fontSize: 11.5,
    color: THEME.colors.textMuted,
    marginTop: 2
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#22C55E',
    letterSpacing: 0.6
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4
  },
  statsCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    paddingHorizontal: 16,
    marginBottom: 24
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14
  },
  statLabel: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
    flex: 1,
    marginLeft: 10
  },
  statValue: {
    fontSize: 13,
    color: THEME.colors.textPrimary,
    fontWeight: '700'
  },
  statDivider: {
    height: 1,
    backgroundColor: THEME.colors.borderSubtle
  },
  accountsCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    paddingHorizontal: 16,
    marginBottom: 24
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14
  },
  accountName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: THEME.colors.textPrimary
  },
  accountSub: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 2
  },
  diagCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    paddingHorizontal: 16,
    marginBottom: 24
  },
  diagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12
  },
  diagLabel: {
    fontSize: 12.5,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
    flex: 1,
    marginLeft: 10
  },
  diagValue: {
    fontSize: 12,
    color: THEME.colors.textPrimary,
    fontWeight: '700'
  },
  systemActions: {
    gap: 12,
    marginTop: 4
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.borderActive,
    paddingVertical: 12,
    borderRadius: THEME.radius.md
  },
  refreshBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700'
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingVertical: 12,
    borderRadius: THEME.radius.md
  },
  logoutBtnText: {
    color: THEME.colors.danger,
    fontSize: 13,
    fontWeight: '700'
  }
});
