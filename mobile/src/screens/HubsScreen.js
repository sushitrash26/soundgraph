import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  Pressable, 
  Image, 
  ActivityIndicator, 
  Modal, 
  TextInput 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { 
  Music, 
  Tv, 
  ArrowRight, 
  Check, 
  Copy, 
  Lock, 
  Globe, 
  X,
  Sparkles
} from 'lucide-react-native';
import { THEME } from '../theme/theme';
import { useMobileStore } from '../store/useMobileStore';

export default function HubsScreen() {
  const {
    activePlatformTab,
    setActivePlatformTab,
    youtubeProfile,
    youtubePlaylists,
    spotifyProfile,
    spotifyPlaylists,
    isLoadingPlatformData,
    isMigrationModalOpen,
    activeMigrationPlaylist,
    activeSourcePlatform,
    isResolvingTracks,
    migrationResolveData,
    isMigratingExecution,
    migrationResult,
    openMigrationModal,
    closeMigrationModal,
    executeMigration
  } = useMobileStore();

  const [customTitle, setCustomTitle] = useState('');
  const [customPrivacy, setCustomPrivacy] = useState('private');
  const [copied, setCopied] = useState(false);

  const isYouTube = activePlatformTab === 'youtube';
  const currentProfile = isYouTube ? youtubeProfile : spotifyProfile;
  const currentPlaylists = isYouTube ? youtubePlaylists : spotifyPlaylists;

  const handleOpenMigration = (playlist, source) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCustomTitle(playlist.title || 'Migrated Playlist');
    setCustomPrivacy('private');
    setCopied(false);
    openMigrationModal(playlist, source);
  };

  const handleCopyClipboard = async (text) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Segmented Platform Switcher */}
        <View style={styles.segmentedContainer}>
          <Pressable
            style={[styles.segmentTab, isYouTube && styles.segmentTabActiveYT]}
            onPress={() => {
              Haptics.selectionAsync();
              setActivePlatformTab('youtube');
            }}
          >
            <Tv size={15} color={isYouTube ? '#FFFFFF' : THEME.colors.textMuted} />
            <Text style={[styles.segmentText, isYouTube && styles.segmentTextActive]}>
              YouTube Music
            </Text>
          </Pressable>

          <Pressable
            style={[styles.segmentTab, !isYouTube && styles.segmentTabActiveSP]}
            onPress={() => {
              Haptics.selectionAsync();
              setActivePlatformTab('spotify');
            }}
          >
            <Music size={15} color={!isYouTube ? '#FFFFFF' : THEME.colors.textMuted} />
            <Text style={[styles.segmentText, !isYouTube && styles.segmentTextActive]}>
              Spotify Hub
            </Text>
          </Pressable>
        </View>

        {/* Taste Profile Radar Card */}
        <LinearGradient
          colors={isYouTube ? ['rgba(239, 68, 68, 0.1)', THEME.colors.surface] : ['rgba(29, 185, 84, 0.1)', THEME.colors.surface]}
          style={[styles.profileCard, { borderColor: isYouTube ? 'rgba(239, 68, 68, 0.3)' : 'rgba(29, 185, 84, 0.3)' }]}
        >
          <View style={styles.profileHeader}>
            <View>
              <Text style={styles.platformLabel}>
                {isYouTube ? 'YOUTUBE MUSIC TASTE PROFILE' : 'SPOTIFY MUSIC TASTE PROFILE'}
              </Text>
              <Text style={styles.profileTitle}>
                {currentProfile?.display_name || (isYouTube ? 'YouTube Library' : 'Spotify Library')}
              </Text>
            </View>
            <View style={[styles.countBadge, { backgroundColor: isYouTube ? 'rgba(239, 68, 68, 0.2)' : 'rgba(29, 185, 84, 0.2)' }]}>
              <Text style={[styles.countText, { color: isYouTube ? '#F87171' : '#4ADE80' }]}>
                {currentProfile?.total_tracks || 0} Tracks
              </Text>
            </View>
          </View>

          {/* Top Artists */}
          <Text style={styles.subSectionTitle}>Top Streamed Artists</Text>
          <View style={styles.pillsRow}>
            {currentProfile?.top_artists && currentProfile.top_artists.length > 0 ? (
              currentProfile.top_artists.slice(0, 5).map((artist, idx) => (
                <View key={idx} style={[styles.pill, { borderColor: isYouTube ? 'rgba(239, 68, 68, 0.3)' : 'rgba(29, 185, 84, 0.3)' }]}>
                  <Text style={[styles.pillText, { color: isYouTube ? '#FCA5A5' : '#86EFAC' }]}>{artist}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyNotice}>No artist nodes indexed in graph</Text>
            )}
          </View>

          {/* Top Genres */}
          <Text style={[styles.subSectionTitle, { marginTop: 14 }]}>Top Latent Graph Genres</Text>
          <View style={styles.pillsRow}>
            {currentProfile?.top_genres && currentProfile.top_genres.length > 0 ? (
              currentProfile.top_genres.slice(0, 4).map((genre, idx) => (
                <View key={idx} style={styles.genrePill}>
                  <Text style={styles.genrePillText}>{genre}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyNotice}>No genre vectors indexed in graph</Text>
            )}
          </View>
        </LinearGradient>

        {/* Playlists Ledger */}
        <View style={styles.ledgerHeaderRow}>
          <Text style={styles.sectionHeader}>
            {isYouTube ? 'YouTube Playlists (➔ Spotify)' : 'Spotify Playlists (➔ YouTube)'}
          </Text>
        </View>
        <Text style={styles.sectionSubtitle}>
          Select any playlist to resolve cross-platform matches and create on target platform.
        </Text>

        {isLoadingPlatformData ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={THEME.colors.accent} />
            <Text style={styles.loadingText}>Fetching graph playlists...</Text>
          </View>
        ) : currentPlaylists && currentPlaylists.length > 0 ? (
          currentPlaylists.map((pl) => (
            <View key={pl.id} style={styles.playlistCard}>
              <View style={styles.playlistInfoRow}>
                {pl.cover_url ? (
                  <Image source={{ uri: pl.cover_url }} style={styles.playlistThumb} />
                ) : (
                  <View style={styles.playlistThumbFallback}>
                    <Music size={20} color={THEME.colors.accent} />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.playlistTitle} numberOfLines={1}>{pl.title}</Text>
                  <Text style={styles.playlistSubtitle} numberOfLines={1}>
                    {pl.track_count || pl.tracks?.length || 0} tracks · {pl.privacy || 'private'}
                  </Text>
                </View>
              </View>

              <Pressable
                style={[styles.migrateButton, { backgroundColor: isYouTube ? '#166534' : '#991B1B' }]}
                onPress={() => handleOpenMigration(pl, activePlatformTab)}
              >
                <Text style={styles.migrateButtonText}>
                  {isYouTube ? 'Migrate to Spotify' : 'Migrate to YouTube'}
                </Text>
                <ArrowRight size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Music size={28} color={THEME.colors.textMuted} />
            <Text style={styles.emptyTitle}>No Playlists Found</Text>
            <Text style={styles.emptyBody}>
              {isYouTube ? 'No YouTube Music playlists synced yet.' : 'No Spotify playlists found in graph.'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Migration Slide-up Modal */}
      <Modal
        visible={isMigrationModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={closeMigrationModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Cross-Platform Migration</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  "{activeMigrationPlaylist?.title}" ({activeSourcePlatform === 'youtube' ? 'YouTube ➔ Spotify' : 'Spotify ➔ YouTube'})
                </Text>
              </View>
              <Pressable onPress={closeMigrationModal} style={styles.closeButton}>
                <X size={18} color={THEME.colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              {isResolvingTracks ? (
                <View style={styles.modalLoadingBox}>
                  <ActivityIndicator size="large" color={THEME.colors.accent} />
                  <Text style={styles.modalLoadingText}>Matching tracks via Deezer & iTunes latent embeddings...</Text>
                </View>
              ) : migrationResult ? (
                <View style={styles.resultBox}>
                  <View style={styles.successIcon}>
                    <Check size={24} color="#22C55E" />
                  </View>
                  <Text style={styles.resultTitle}>
                    {migrationResult.method === 'clipboard' ? 'Ready for 1-Click Paste!' : 'Migration Complete!'}
                  </Text>
                  <Text style={styles.resultMessage}>{migrationResult.message}</Text>

                  {migrationResult.method === 'clipboard' && (
                    <Pressable
                      style={[styles.copyButton, copied && { backgroundColor: '#15803D' }]}
                      onPress={() => handleCopyClipboard(migrationResult.clipboard_text)}
                    >
                      {copied ? <Check size={16} color="#FFF" /> : <Copy size={16} color="#FFF" />}
                      <Text style={styles.copyButtonText}>
                        {copied ? 'Copied to Clipboard!' : `Copy ${migrationResult.track_count} Tracks`}
                      </Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                <View style={{ gap: 14 }}>
                  <View style={styles.matchStatsBox}>
                    <Text style={styles.matchStatsTitle}>Engine Match Rate</Text>
                    <Text style={styles.matchStatsNumber}>
                      {migrationResolveData?.match_rate || 100}% Matched
                    </Text>
                    <Text style={styles.matchStatsSub}>
                      {migrationResolveData?.matched_count || 0} of {migrationResolveData?.total_count || 0} tracks confirmed
                    </Text>
                  </View>

                  <Text style={styles.inputLabel}>New Playlist Title</Text>
                  <TextInput
                    style={styles.textInput}
                    value={customTitle}
                    onChangeText={setCustomTitle}
                    placeholder="Enter playlist title"
                    placeholderTextColor="#666"
                  />

                  <Text style={styles.inputLabel}>Privacy Setting</Text>
                  <View style={styles.privacyRow}>
                    {['private', 'public'].map((priv) => (
                      <Pressable
                        key={priv}
                        style={[styles.privacyBtn, customPrivacy === priv && styles.privacyBtnActive]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setCustomPrivacy(priv);
                        }}
                      >
                        {priv === 'private' ? <Lock size={12} color="#FFF" /> : <Globe size={12} color="#FFF" />}
                        <Text style={styles.privacyBtnText}>{priv.toUpperCase()}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {activeSourcePlatform === 'youtube' ? (
                    <Pressable
                      style={styles.actionBtnSpotify}
                      disabled={isMigratingExecution}
                      onPress={() => executeMigration({
                        sourcePlatform: 'youtube',
                        targetPlatform: 'spotify',
                        title: customTitle,
                        privacy: customPrivacy,
                        tracks: migrationResolveData?.matched_tracks || [],
                        method: 'clipboard'
                      })}
                    >
                      {isMigratingExecution ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <>
                          <Copy size={16} color="#000" />
                          <Text style={styles.actionBtnTextSpotify}>1-Click Copy for Spotify (Ctrl+V)</Text>
                        </>
                      )}
                    </Pressable>
                  ) : (
                    <Pressable
                      style={styles.actionBtnYouTube}
                      disabled={isMigratingExecution}
                      onPress={() => executeMigration({
                        sourcePlatform: 'spotify',
                        targetPlatform: 'youtube',
                        title: customTitle,
                        privacy: customPrivacy,
                        tracks: migrationResolveData?.matched_tracks || [],
                        method: 'direct'
                      })}
                    >
                      {isMigratingExecution ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <Tv size={16} color="#FFF" />
                          <Text style={styles.actionBtnTextYouTube}>Direct Sync to YouTube Music</Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: THEME.radius.md
  },
  segmentTabActiveYT: {
    backgroundColor: THEME.colors.youtube
  },
  segmentTabActiveSP: {
    backgroundColor: '#15803D'
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textMuted
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  profileCard: {
    borderRadius: THEME.radius.xl,
    padding: 18,
    borderWidth: 1,
    marginBottom: 24
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14
  },
  platformLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8
  },
  profileTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginTop: 2
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm
  },
  countText: {
    fontSize: 12,
    fontWeight: '800'
  },
  subSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase'
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  pill: {
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm
  },
  pillText: {
    fontSize: 11.5,
    fontWeight: '600'
  },
  genrePill: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm
  },
  genrePillText: {
    color: THEME.colors.textSecondary,
    fontSize: 11.5,
    fontWeight: '600'
  },
  emptyNotice: {
    color: THEME.colors.textMuted,
    fontSize: 11.5,
    fontStyle: 'italic'
  },
  ledgerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectionHeader: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.colors.textPrimary
  },
  sectionSubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 3,
    marginBottom: 14
  },
  playlistCard: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    borderRadius: THEME.radius.lg,
    padding: 14,
    marginBottom: 12
  },
  playlistInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  playlistThumb: {
    width: 48,
    height: 48,
    borderRadius: THEME.radius.md
  },
  playlistThumbFallback: {
    width: 48,
    height: 48,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center'
  },
  playlistTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary
  },
  playlistSubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2
  },
  migrateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: THEME.radius.md
  },
  migrateButtonText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700'
  },
  loadingBox: {
    padding: 30,
    alignItems: 'center',
    gap: 8
  },
  loadingText: {
    fontSize: 12,
    color: THEME.colors.textSecondary
  },
  emptyCard: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10
  },
  emptyBody: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderActive
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.colors.textPrimary
  },
  modalSubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
    maxWidth: 260
  },
  closeButton: {
    padding: 6
  },
  modalLoadingBox: {
    padding: 30,
    alignItems: 'center',
    gap: 10
  },
  modalLoadingText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    textAlign: 'center'
  },
  resultBox: {
    padding: 16,
    alignItems: 'center'
  },
  successIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.textPrimary
  },
  resultMessage: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 4,
    textAlign: 'center'
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#16A34A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: THEME.radius.md,
    marginTop: 14
  },
  copyButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700'
  },
  matchStatsBox: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle
  },
  matchStatsTitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '700'
  },
  matchStatsNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#22C55E',
    marginTop: 2
  },
  matchStatsSub: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 2
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    textTransform: 'uppercase'
  },
  textInput: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    borderRadius: THEME.radius.md,
    padding: 12,
    color: '#FFF',
    fontSize: 13
  },
  privacyRow: {
    flexDirection: 'row',
    gap: 8
  },
  privacyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.colors.surfaceElevated,
    paddingVertical: 10,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle
  },
  privacyBtnActive: {
    borderColor: THEME.colors.accent,
    backgroundColor: 'rgba(168, 85, 247, 0.15)'
  },
  privacyBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFF'
  },
  actionBtnSpotify: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1DB954',
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
    marginTop: 6
  },
  actionBtnTextSpotify: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800'
  },
  actionBtnYouTube: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.youtube,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
    marginTop: 6
  },
  actionBtnTextYouTube: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800'
  }
});
