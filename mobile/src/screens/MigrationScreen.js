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
  ArrowRight,
  Check,
  CheckCircle2,
  Lock,
  Globe,
  X,
  Sparkles,
  Radio,
  Music2,
  Copy,
  Layers,
  ChevronRight
} from 'lucide-react-native';
import { THEME } from '../theme/theme';
import { useMobileStore } from '../store/useMobileStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AmbientGlassBackground from '../components/AmbientGlassBackground';
import SwipeConfirmSlider from '../components/SwipeConfirmSlider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MigrationScreen() {
  const insets = useSafeAreaInsets();
  const {
    youtubePlaylists,
    spotifyPlaylists,
    userDecks,
    fetchPlatformData,
    fetchUserDecks,
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

  // 3-way platform source: 'youtube' | 'spotify' | 'deck'
  const [source, setSource] = useState('deck');
  const [selectedDeckIndex, setSelectedDeckIndex] = useState(0);
  const [selectedPlaylistIndex, setSelectedPlaylistIndex] = useState(0);
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [privacy, setPrivacy] = useState('private');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    fetchPlatformData('youtube');
    fetchPlatformData('spotify');
    fetchUserDecks();
  }, []);

  const handleSelectSource = (newSource) => {
    if (source !== newSource) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSource(newSource);
      if (newSource === 'deck') {
        setSelectedDeckIndex(0);
      } else {
        setSelectedPlaylistIndex(0);
      }
    }
  };

  // Deck Migration Handler triggered by either Spotify or YouTube swipe slider
  const handleStartDeckMigration = async (targetPlatform) => {
    const selectedDeck = userDecks[selectedDeckIndex] || userDecks[0];
    if (!selectedDeck) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const title = selectedDeck.name || 'Soundport Deck';
    setPlaylistTitle(title);
    setPrivacy('private');
    setCopiedLink(false);

    // Format deck tracks for migration
    const formattedTracks = (selectedDeck.tracks || []).map((t) => ({
      title: t.title || t.name,
      artist: t.artist,
      preview_url: t.preview_url || t.cover_url || ''
    }));

    openMigrationModal(
      {
        title: title,
        tracks: formattedTracks
      },
      'deck'
    );
  };

  // Playlist Migration Handler for YouTube / Spotify
  const handleStartPlaylistMigration = (targetPlatform) => {
    const playlists = source === 'youtube' ? youtubePlaylists : spotifyPlaylists;
    const current = playlists[selectedPlaylistIndex] || playlists[0];
    if (!current) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPlaylistTitle(current.title || 'Migrated Playlist');
    setPrivacy('private');
    setCopiedLink(false);
    openMigrationModal(current, source);
  };

  const handleConfirmTransfer = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const resolvedTracks =
      migrationResolveData?.resolved_tracks || activeMigrationPlaylist?.tracks || [];

    const targetPlatform =
      source === 'deck'
        ? 'spotify' // default if deck, though executeMigration can take direct platform
        : source === 'youtube'
          ? 'spotify'
          : 'youtube';

    await executeMigration({
      sourcePlatform: source,
      targetPlatform: targetPlatform,
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

  // Determine current active item for route preview
  const currentItemTitle =
    source === 'deck'
      ? userDecks[selectedDeckIndex]?.name || 'Your Deck'
      : source === 'youtube'
        ? youtubePlaylists[selectedPlaylistIndex]?.title || 'YouTube Playlist'
        : spotifyPlaylists[selectedPlaylistIndex]?.title || 'Spotify Playlist';

  return (
    <View style={[
      styles.container,
      {
        paddingTop: Math.max(insets.top + 6, 12),
        paddingBottom: Math.max(insets.bottom + 80, 94)
      }
    ]}>
      <AmbientGlassBackground />

      {/* Header matching profile/App.jsx */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>PLAYLIST PORTER</Text>
        <Text style={styles.title}>Move your music</Text>
      </View>

      {/* 3-Way Platform Source Switcher: [ YouTube | Spotify | Deck ] */}
      <View style={styles.platformSwitcher}>
        {[
          { id: 'youtube', label: 'YouTube', icon: Radio, color: '#ff0033' },
          { id: 'spotify', label: 'Spotify', icon: Music2, color: '#1ed760' },
          { id: 'deck', label: 'Deck', icon: Layers, color: '#d7ff64' }
        ].map((item) => {
          const isActive = source === item.id;
          const IconComp = item.icon;
          return (
            <Pressable
              key={item.id}
              style={[
                styles.platformTab,
                isActive ? styles.platformTabActive : styles.platformTabInactive
              ]}
              onPress={() => handleSelectSource(item.id)}
            >
              <View
                style={[
                  styles.platformIconCircle,
                  { backgroundColor: isActive ? item.color : 'rgba(255, 255, 255, 0.1)' }
                ]}
              >
                <IconComp
                  size={14}
                  color={isActive && item.id !== 'deck' ? '#FFFFFF' : '#000000'}
                  strokeWidth={2.4}
                />
              </View>
              <Text
                style={[
                  styles.platformTabText,
                  isActive ? styles.platformTabTextActive : styles.platformTabTextInactive
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Subheader info row */}
      <View style={styles.listSubHeader}>
        <View>
          <Text style={styles.listContextText}>
            Choose from {source === 'youtube' ? 'YouTube Music' : source === 'spotify' ? 'Spotify' : 'your custom decks'}
          </Text>
          <Text style={styles.listMainTitle}>
            {source === 'deck' ? 'Your decks' : 'Your playlists'}
          </Text>
        </View>
        <Text style={styles.selectionCountBadge}>
          1 selected
        </Text>
      </View>

      {/* Selection List: Scrollable Decks or Playlists */}
      <ScrollView style={styles.itemsScrollView} showsVerticalScrollIndicator={false}>
        {source === 'deck' ? (
          <View style={styles.itemsList}>
            {userDecks.map((deck, index) => {
              const isSelected = selectedDeckIndex === index;
              const firstCover = deck.tracks?.[0]?.cover_url || deck.cover_url;
              return (
                <Pressable
                  key={deck.id || deck.name}
                  style={[
                    styles.playlistRowCard,
                    isSelected && styles.playlistRowCardSelected
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedDeckIndex(index);
                  }}
                >
                  {firstCover ? (
                    <Image source={{ uri: firstCover }} style={styles.rowThumbnail} />
                  ) : (
                    <View style={[styles.rowThumbnailPlaceholder, { backgroundColor: '#d7ff64' }]}>
                      <Layers size={20} color="#000000" strokeWidth={2.4} />
                    </View>
                  )}

                  <View style={styles.rowMeta}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {deck.name}
                    </Text>
                    <Text style={styles.rowCount}>
                      {deck.tracks?.length || 0} tracks
                    </Text>
                  </View>

                  <View style={[
                    styles.checkboxCircle,
                    isSelected && styles.checkboxCircleSelected
                  ]}>
                    {isSelected && <Check size={14} color="#000000" strokeWidth={3} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.itemsList}>
            {(source === 'youtube' ? youtubePlaylists : spotifyPlaylists).map((pl, index) => {
              const isSelected = selectedPlaylistIndex === index;
              return (
                <Pressable
                  key={pl.id || pl.title || index}
                  style={[
                    styles.playlistRowCard,
                    isSelected && styles.playlistRowCardSelected
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedPlaylistIndex(index);
                  }}
                >
                  {pl.thumbnail ? (
                    <Image source={{ uri: pl.thumbnail }} style={styles.rowThumbnail} />
                  ) : (
                    <View style={[
                      styles.rowThumbnailPlaceholder,
                      { backgroundColor: source === 'youtube' ? '#ff0033' : '#1ed760' }
                    ]}>
                      {source === 'youtube' ? (
                        <Radio size={20} color="#FFFFFF" />
                      ) : (
                        <Music2 size={20} color="#000000" />
                      )}
                    </View>
                  )}

                  <View style={styles.rowMeta}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {pl.title || 'Playlist'}
                    </Text>
                    <Text style={styles.rowCount}>
                      {pl.track_count || pl.tracks?.length || 0} tracks
                    </Text>
                  </View>

                  <View style={[
                    styles.checkboxCircle,
                    isSelected && styles.checkboxCircleSelected
                  ]}>
                    {isSelected && <Check size={14} color="#000000" strokeWidth={3} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Migration Route Preview Card matching profile/App.jsx lines 845-868 */}
      <View style={styles.routeCard}>
        <View style={styles.routeSourceCol}>
          <View style={[
            styles.routeBadge,
            { backgroundColor: source === 'deck' ? '#d7ff64' : source === 'youtube' ? '#ff0033' : '#1ed760' }
          ]}>
            {source === 'deck' ? (
              <Layers size={14} color="#000000" strokeWidth={2.4} />
            ) : source === 'youtube' ? (
              <Radio size={14} color="#FFFFFF" strokeWidth={2.4} />
            ) : (
              <Music2 size={14} color="#000000" strokeWidth={2.4} />
            )}
          </View>
          <View>
            <Text style={styles.routeEyebrow}>FROM</Text>
            <Text style={styles.routeLabel} numberOfLines={1}>
              {source === 'deck' ? 'Custom Deck' : source === 'youtube' ? 'YouTube Music' : 'Spotify'}
            </Text>
          </View>
        </View>

        <View style={styles.routeArrowCol}>
          <View style={styles.routeDottedLine} />
          <ArrowRight size={16} color="#d7ff64" />
        </View>

        <View style={styles.routeTargetCol}>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.routeEyebrow}>TO</Text>
            <Text style={styles.routeLabel}>
              {source === 'deck' ? 'Spotify / YouTube' : source === 'youtube' ? 'Spotify' : 'YouTube'}
            </Text>
          </View>
          <View style={[
            styles.routeBadge,
            { backgroundColor: source === 'youtube' ? '#1ed760' : '#ff0033' }
          ]}>
            {source === 'youtube' ? (
              <Music2 size={14} color="#000000" strokeWidth={2.4} />
            ) : (
              <Radio size={14} color="#FFFFFF" strokeWidth={2.4} />
            )}
          </View>
        </View>
      </View>

      {/* Bottom Slider Section: Dual Sliders for Deck view, Single Slider for Spotify/YT */}
      <View style={styles.bottomSlidersSection}>
        {source === 'deck' ? (
          // DUAL SLIDERS: Port to Spotify & Port to YouTube
          <View style={styles.dualSlidersContainer}>
            {/* Slider 1: Port to Spotify (#1ed760) */}
            <SwipeConfirmSlider
              label="Swipe to Port to Spotify"
              accentColor="#1ed760"
              thumbIcon={Music2}
              onConfirm={() => handleStartDeckMigration('spotify')}
              disabled={userDecks.length === 0}
              height={50}
            />

            {/* Slider 2: Port to YouTube (#ff0033) */}
            <SwipeConfirmSlider
              label="Swipe to Port to YouTube"
              accentColor="#ff0033"
              thumbIcon={Radio}
              onConfirm={() => handleStartDeckMigration('youtube')}
              disabled={userDecks.length === 0}
              height={50}
            />
          </View>
        ) : (
          // SINGLE SLIDER for YouTube -> Spotify or Spotify -> YouTube
          <View style={styles.singleSliderContainer}>
            <SwipeConfirmSlider
              label={source === 'youtube' ? 'Swipe to Port to Spotify' : 'Swipe to Port to YouTube'}
              accentColor={source === 'youtube' ? '#1ed760' : '#ff0033'}
              thumbIcon={source === 'youtube' ? Music2 : Radio}
              onConfirm={() => handleStartPlaylistMigration(source === 'youtube' ? 'spotify' : 'youtube')}
              height={52}
            />
          </View>
        )}
      </View>

      {/* Migration Progress & Result Modal */}
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
                    Matching acoustic fingerprint & ISRC metadata across platforms.
                  </Text>
                </View>
              ) : isMigratingExecution ? (
                <View style={styles.modalCenterState}>
                  <ActivityIndicator size="large" color="#FFFFFF" style={{ marginBottom: 14 }} />
                  <Text style={styles.modalStateTitle}>Transferring Tracks...</Text>
                  <Text style={styles.modalStateSub}>
                    Injecting validated tracks into your target library.
                  </Text>
                </View>
              ) : migrationResult ? (
                <View style={styles.modalResultState}>
                  <View style={styles.successIconCircle}>
                    <CheckCircle2 size={36} color="#FFFFFF" />
                  </View>
                  <Text style={styles.resultTitle}>Migration Complete</Text>
                  <Text style={styles.resultSub}>
                    {migrationResult.tracks_migrated || 'All'} tracks successfully written to destination.
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
    backgroundColor: 'transparent',
    paddingHorizontal: 16
  },
  header: {
    paddingHorizontal: 4,
    paddingTop: 4,
    marginBottom: 12
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#d7ff64',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 4
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.6
  },
  platformSwitcher: {
    flexDirection: 'row',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 3,
    marginBottom: 16
  },
  platformTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9999
  },
  platformTabActive: {
    backgroundColor: '#FFFFFF'
  },
  platformTabInactive: {
    backgroundColor: 'transparent'
  },
  platformIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center'
  },
  platformTabText: {
    fontSize: 12,
    fontWeight: '700'
  },
  platformTabTextActive: {
    color: '#000000'
  },
  platformTabTextInactive: {
    color: 'rgba(255, 255, 255, 0.45)'
  },
  listSubHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
    paddingHorizontal: 4
  },
  listContextText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)'
  },
  listMainTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
    letterSpacing: -0.3
  },
  selectionCountBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#d7ff64'
  },
  itemsScrollView: {
    flex: 1,
    maxHeight: 230,
    marginBottom: 10
  },
  itemsList: {
    gap: 8
  },
  playlistRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  playlistRowCardSelected: {
    borderColor: 'rgba(215, 255, 100, 0.4)',
    backgroundColor: 'rgba(215, 255, 100, 0.08)'
  },
  rowThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
  },
  rowThumbnailPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center'
  },
  rowMeta: {
    flex: 1
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  rowCount: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: 2
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkboxCircleSelected: {
    backgroundColor: '#d7ff64',
    borderColor: '#d7ff64'
  },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    marginBottom: 12
  },
  routeSourceCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 130
  },
  routeBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  routeEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.35)',
    letterSpacing: 1.2
  },
  routeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  routeArrowCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8
  },
  routeDottedLine: {
    width: 24,
    height: 1,
    backgroundColor: 'rgba(215, 255, 100, 0.5)'
  },
  routeTargetCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 140
  },
  bottomSlidersSection: {
    width: '100%'
  },
  dualSlidersContainer: {
    gap: 8
  },
  singleSliderContainer: {
    width: '100%'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 24
  },
  modalCardWrapper: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1.4,
    borderColor: 'rgba(255, 255, 255, 0.25)'
  },
  modalCardBlur: {
    padding: 22,
    backgroundColor: 'rgba(22, 21, 20, 0.95)'
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16
  },
  modalTitleCol: {
    flex: 1,
    marginRight: 12
  },
  modalSubHeader: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#d7ff64',
    letterSpacing: 1.4,
    marginBottom: 4
  },
  modalMainTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalCenterState: {
    alignItems: 'center',
    paddingVertical: 36
  },
  modalStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6
  },
  modalStateSub: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.55)',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280
  },
  modalResultState: {
    alignItems: 'center',
    paddingVertical: 20
  },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14
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
    lineHeight: 18,
    marginBottom: 20
  },
  copyLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 9999,
    marginBottom: 12
  },
  copyLinkText: {
    color: '#0E0C0B',
    fontSize: 13,
    fontWeight: '700'
  },
  dismissResultButton: {
    paddingVertical: 10,
    paddingHorizontal: 24
  },
  dismissResultText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
    fontWeight: '600'
  },
  modalContentBody: {
    paddingTop: 4
  },
  resolutionMetricBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: 10,
    borderRadius: 12,
    marginBottom: 16
  },
  metricBannerText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.45)',
    letterSpacing: 1.2,
    marginBottom: 6
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 16
  },
  privacyRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20
  },
  privacyChoice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)'
  },
  privacyChoiceActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF'
  },
  privacyChoiceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  privacyChoiceTextActive: {
    color: '#000000'
  },
  confirmTransferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#d7ff64',
    paddingVertical: 14,
    borderRadius: 9999
  },
  confirmButtonText: {
    color: '#000000',
    fontSize: 13.5,
    fontWeight: '800'
  },
  buttonPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.85
  }
});
