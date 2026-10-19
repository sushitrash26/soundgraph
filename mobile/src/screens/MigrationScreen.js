import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  Dimensions
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import {
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  Lock,
  Globe,
  X,
  Sparkles,
  Radio,
  Music2,
  Copy,
  Layers
} from 'lucide-react-native';
import { THEME } from '../theme/theme';
import { useMobileStore } from '../store/useMobileStore';
import AmbientGlassBackground from '../components/AmbientGlassBackground';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MigrationScreen() {
  const {
    youtubePlaylists,
    spotifyPlaylists,
    fetchPlatformData,
    isLoadingPlatformData,
    isMigrationModalOpen,
    activeMigrationPlaylist,
    isResolvingTracks,
    migrationResolveData,
    isMigratingExecution,
    migrationResult,
    openMigrationModal,
    closeMigrationModal,
    executeMigration
  } = useMobileStore();

  const [direction, setDirection] = useState('yt_to_spotify');
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [privacy, setPrivacy] = useState('private');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    fetchPlatformData('youtube');
    fetchPlatformData('spotify');
  }, []);

  const isYtSource = direction === 'yt_to_spotify';
  const sourcePlaylists = isYtSource ? youtubePlaylists : spotifyPlaylists;
  const targetPlatformName = isYtSource ? 'Spotify' : 'YouTube Music';
  const sourcePlatformName = isYtSource ? 'YouTube Music' : 'Spotify';

  const handleSelectDirection = (newDir) => {
    if (direction !== newDir) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setDirection(newDir);
    }
  };

  const handleStartMigration = (playlist) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPlaylistTitle(playlist.title || 'Migrated Playlist');
    setPrivacy('private');
    setCopiedLink(false);
    openMigrationModal(playlist, isYtSource ? 'youtube' : 'spotify');
  };

  const handleConfirmTransfer = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const resolvedTracks = migrationResolveData?.resolved_tracks || activeMigrationPlaylist?.tracks || [];
    await executeMigration({
      sourcePlatform: isYtSource ? 'youtube' : 'spotify',
      targetPlatform: isYtSource ? 'spotify' : 'youtube',
      title: playlistTitle,
      description: `Migrated via SoundGraph Engine`,
      privacy: privacy,
      tracks: resolvedTracks
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleCopyResult = async (url) => {
    if (!url) return;
    await Clipboard.setStringAsync(url);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  return (
    <View style={styles.container}>
      <AmbientGlassBackground />

      {/* Top Segmented Direction Switcher (Reference image [ Living room ] [ Kitchen ] style) */}
      <View style={styles.switcherContainer}>
        <View style={styles.switcherPillGroup}>
          <Pressable
            style={[
              styles.switcherPill,
              isYtSource ? styles.switcherPillActive : styles.switcherPillInactive
            ]}
            onPress={() => handleSelectDirection('yt_to_spotify')}
          >
            <Radio size={14} color={isYtSource ? '#181716' : 'rgba(255, 255, 255, 0.75)'} />
            <Text
              style={[
                styles.switcherPillText,
                isYtSource ? styles.switcherPillTextActive : styles.switcherPillTextInactive
              ]}
            >
              YT Music → Spotify
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.switcherPill,
              !isYtSource ? styles.switcherPillActive : styles.switcherPillInactive
            ]}
            onPress={() => handleSelectDirection('spotify_to_yt')}
          >
            <Music2 size={14} color={!isYtSource ? '#181716' : 'rgba(255, 255, 255, 0.75)'} />
            <Text
              style={[
                styles.switcherPillText,
                !isYtSource ? styles.switcherPillTextActive : styles.switcherPillTextInactive
              ]}
            >
              Spotify → YT Music
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Subheader info row */}
      <View style={styles.subHeader}>
        <View style={styles.directionBadgeWrapper}>
          <BlurView intensity={60} tint="light" style={styles.directionBadgeBlur}>
            <ArrowLeftRight size={12} color="#FFFFFF" />
            <Text style={styles.directionBadgeText}>
              SOURCE: {sourcePlatformName.toUpperCase()}
            </Text>
          </BlurView>
        </View>
        <Text style={styles.playlistCountText}>
          {sourcePlaylists.length} playlists available
        </Text>
      </View>

      {/* Playlists Feed */}
      <ScrollView
        contentContainerStyle={styles.scrollList}
        showsVerticalScrollIndicator={false}
      >
        {isLoadingPlatformData && sourcePlaylists.length === 0 ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.loadingText}>Syncing library playlists...</Text>
          </View>
        ) : sourcePlaylists.length === 0 ? (
          <View style={styles.emptyWrapper}>
            <Layers size={32} color="rgba(255, 255, 255, 0.5)" />
            <Text style={styles.emptyTitle}>No Playlists Found</Text>
            <Text style={styles.emptySub}>
              Ensure your {sourcePlatformName} account is connected with playlist read permissions.
            </Text>
          </View>
        ) : (
          sourcePlaylists.map((playlist, idx) => {
            const trackCount = playlist.item_count || playlist.track_count || (playlist.tracks ? playlist.tracks.length : 0);
            return (
              <View key={playlist.id || idx} style={styles.playlistCard}>
                <BlurView intensity={75} tint="light" style={styles.cardBlur}>
                  <View style={styles.cardHeaderRow}>
                    <Image
                      source={{
                        uri: playlist.thumbnail || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300'
                      }}
                      style={styles.playlistThumb}
                      resizeMode="cover"
                    />

                    <View style={styles.metadataCol}>
                      <Text style={styles.playlistTitle} numberOfLines={1}>
                        {playlist.title}
                      </Text>
                      <View style={styles.badgeRow}>
                        <View style={styles.trackCountBadge}>
                          <Text style={styles.trackCountText}>{trackCount} Tracks</Text>
                        </View>
                        {playlist.privacy === 'public' ? (
                          <View style={styles.privacyPill}>
                            <Globe size={10} color="rgba(255, 255, 255, 0.6)" />
                            <Text style={styles.privacyText}>Public</Text>
                          </View>
                        ) : (
                          <View style={styles.privacyPill}>
                            <Lock size={10} color="rgba(255, 255, 255, 0.6)" />
                            <Text style={styles.privacyText}>Private</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* 1-Tap Solid White Transfer CTA Button */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.transferButton,
                      pressed && styles.buttonPressed
                    ]}
                    onPress={() => handleStartMigration(playlist)}
                  >
                    <Text style={styles.transferButtonText}>
                      Transfer to {targetPlatformName}
                    </Text>
                    <ArrowRight size={15} color="#181716" />
                  </Pressable>
                </BlurView>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Translucent Resolution & Confirmation Modal */}
      <Modal
        visible={isMigrationModalOpen}
        transparent
        animationType="slide"
        onRequestClose={closeMigrationModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCardWrapper}>
            <BlurView intensity={85} tint="light" style={styles.modalCardBlur}>
              <View style={styles.modalHeaderRow}>
                <View style={styles.modalTitleCol}>
                  <Text style={styles.modalSubHeader}>PLAYLIST MIGRATION</Text>
                  <Text style={styles.modalMainTitle} numberOfLines={1}>
                    {activeMigrationPlaylist?.title || 'Playlist'}
                  </Text>
                </View>
                <Pressable style={styles.modalCloseButton} onPress={closeMigrationModal}>
                  <X size={18} color="#FFFFFF" />
                </Pressable>
              </View>

              {isResolvingTracks ? (
                <View style={styles.modalCenterState}>
                  <ActivityIndicator size="large" color="#FFFFFF" style={{ marginBottom: 14 }} />
                  <Text style={styles.modalStateTitle}>Resolving Track Signatures...</Text>
                  <Text style={styles.modalStateSub}>
                    Matching acoustic fingerprint & ISRC metadata on {targetPlatformName}.
                  </Text>
                </View>
              ) : isMigratingExecution ? (
                <View style={styles.modalCenterState}>
                  <ActivityIndicator size="large" color="#FFFFFF" style={{ marginBottom: 14 }} />
                  <Text style={styles.modalStateTitle}>Transferring to {targetPlatformName}...</Text>
                  <Text style={styles.modalStateSub}>
                    Injecting validated tracks into your {targetPlatformName} library.
                  </Text>
                </View>
              ) : migrationResult ? (
                <View style={styles.modalResultState}>
                  <View style={styles.successIconCircle}>
                    <CheckCircle2 size={36} color="#FFFFFF" />
                  </View>
                  <Text style={styles.resultTitle}>Migration Complete</Text>
                  <Text style={styles.resultSub}>
                    {migrationResult.tracks_migrated || 'All'} tracks successfully written to {targetPlatformName}.
                  </Text>

                  {migrationResult.playlist_url && (
                    <Pressable
                      style={styles.copyLinkButton}
                      onPress={() => handleCopyResult(migrationResult.playlist_url)}
                    >
                      <Copy size={14} color="#181716" />
                      <Text style={styles.copyLinkText}>
                        {copiedLink ? 'Link Copied!' : 'Copy Playlist Link'}
                      </Text>
                    </Pressable>
                  )}

                  <Pressable style={styles.dismissResultButton} onPress={closeMigrationModal}>
                    <Text style={styles.dismissResultText}>Done</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.modalContentBody}>
                  <View style={styles.resolutionMetricBanner}>
                    <Sparkles size={14} color="#FFFFFF" />
                    <Text style={styles.metricBannerText}>
                      {migrationResolveData?.match_rate || '100%'} Match Confidence • Lossless Sync
                    </Text>
                  </View>

                  <Text style={styles.inputLabel}>DESTINATION TITLE</Text>
                  <TextInput
                    style={styles.textInput}
                    value={playlistTitle}
                    onChangeText={setPlaylistTitle}
                    placeholder="Playlist Title"
                    placeholderTextColor="rgba(255, 255, 255, 0.45)"
                  />

                  <View style={styles.privacyRow}>
                    <Pressable
                      style={[
                        styles.privacyChoice,
                        privacy === 'private' && styles.privacyChoiceActive
                      ]}
                      onPress={() => setPrivacy('private')}
                    >
                      <Lock size={13} color={privacy === 'private' ? '#181716' : '#FFFFFF'} />
                      <Text
                        style={[
                          styles.privacyChoiceText,
                          privacy === 'private' && styles.privacyChoiceTextActive
                        ]}
                      >
                        Private
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.privacyChoice,
                        privacy === 'public' && styles.privacyChoiceActive
                      ]}
                      onPress={() => setPrivacy('public')}
                    >
                      <Globe size={13} color={privacy === 'public' ? '#181716' : '#FFFFFF'} />
                      <Text
                        style={[
                          styles.privacyChoiceText,
                          privacy === 'public' && styles.privacyChoiceTextActive
                        ]}
                      >
                        Public
                      </Text>
                    </Pressable>
                  </View>

                  <Pressable
                    style={({ pressed }) => [
                      styles.confirmTransferButton,
                      pressed && styles.buttonPressed
                    ]}
                    onPress={handleConfirmTransfer}
                  >
                    <Text style={styles.confirmButtonText}>
                      Execute Lossless Transfer
                    </Text>
                    <ArrowRight size={16} color="#181716" />
                  </Pressable>
                </View>
              )}
            </BlurView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E0C0B',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 90
  },
  switcherContainer: {
    alignItems: 'center',
    marginBottom: 14
  },
  switcherPillGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 9999,
    padding: 3,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    width: '100%',
    maxWidth: 360
  },
  switcherPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 9999,
    gap: 7
  },
  switcherPillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8
  },
  switcherPillInactive: {
    backgroundColor: 'transparent'
  },
  switcherPillText: {
    fontSize: 12.5,
    fontWeight: '700'
  },
  switcherPillTextActive: {
    color: '#181716'
  },
  switcherPillTextInactive: {
    color: 'rgba(255, 255, 255, 0.70)'
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4
  },
  directionBadgeWrapper: {
    borderRadius: 9999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)'
  },
  directionBadgeBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    gap: 6
  },
  directionBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8
  },
  playlistCountText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.65)'
  },
  scrollList: {
    paddingBottom: 24,
    gap: 12
  },
  loadingWrapper: {
    paddingVertical: 48,
    alignItems: 'center'
  },
  loadingText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 10
  },
  emptyWrapper: {
    paddingVertical: 64,
    alignItems: 'center',
    paddingHorizontal: 24
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 12,
    marginBottom: 6
  },
  emptySub: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
    lineHeight: 18
  },
  playlistCard: {
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16
  },
  cardBlur: {
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)'
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14
  },
  playlistThumb: {
    width: 54,
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)'
  },
  metadataCol: {
    marginLeft: 14,
    flex: 1
  },
  playlistTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  trackCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6
  },
  trackCountText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  privacyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  privacyText: {
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.65)'
  },
  transferButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 9999,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10
  },
  transferButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#181716'
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }]
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end'
  },
  modalCardWrapper: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.35)'
  },
  modalCardBlur: {
    padding: 24,
    paddingBottom: 40,
    backgroundColor: 'rgba(30, 24, 20, 0.85)'
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  modalTitleCol: {
    flex: 1,
    marginRight: 12
  },
  modalSubHeader: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginBottom: 2
  },
  modalMainTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalCenterState: {
    paddingVertical: 40,
    alignItems: 'center'
  },
  modalStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6
  },
  modalStateSub: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280
  },
  modalResultState: {
    paddingVertical: 24,
    alignItems: 'center'
  },
  successIconCircle: {
    marginBottom: 12
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6
  },
  resultSub: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
    marginBottom: 18
  },
  copyLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 9999,
    paddingVertical: 11,
    paddingHorizontal: 20,
    marginBottom: 16
  },
  copyLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#181716'
  },
  dismissResultButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 9999
  },
  dismissResultText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  modalContentBody: {
    gap: 12
  },
  resolutionMetricBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)'
  },
  metricBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  inputLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 0.8,
    marginTop: 6
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: '#FFFFFF',
    fontSize: 14
  },
  privacyRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4
  },
  privacyChoice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)'
  },
  privacyChoiceActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF'
  },
  privacyChoiceText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)'
  },
  privacyChoiceTextActive: {
    color: '#181716',
    fontWeight: '700'
  },
  confirmTransferButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 9999,
    gap: 8,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12
  },
  confirmButtonText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#181716'
  }
});
