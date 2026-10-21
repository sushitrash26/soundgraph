import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Image
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import {
  Heart,
  X,
  Sparkles,
  RotateCcw,
  Layers,
  ChevronRight,
  Plus
} from 'lucide-react-native';
import { useSharedValue } from 'react-native-reanimated';
import { THEME } from '../theme/theme';
import { useMobileStore } from '../store/useMobileStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AmbientGlassBackground from '../components/AmbientGlassBackground';
import ThreeDDeckCard from '../components/ThreeDDeckCard';
import SwipeConfirmSlider from '../components/SwipeConfirmSlider';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function InfiniteDeckScreen() {
  const insets = useSafeAreaInsets();
  const {
    user,
    infiniteDeck,
    infiniteIndex,
    isLoadingInfiniteDeck,
    fetchInfiniteDeck,
    swipeInfiniteCard,
    toggleAudioPreview,
    playingTrackId,
    isPlayingAudio,
    userDecks,
    addTrackToCustomDeck,
    createCustomDeck
  } = useMobileStore();

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [isCreatingDeck, setIsCreatingDeck] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');

  const dragProgress = useSharedValue(0);

  useEffect(() => {
    if (infiniteDeck.length === 0) {
      fetchInfiniteDeck();
    }
  }, []);

  const currentCard = infiniteDeck[infiniteIndex] || null;
  const nextCard1 = infiniteDeck[infiniteIndex + 1] || null;
  const nextCard2 = infiniteDeck[infiniteIndex + 2] || null;

  const isPlayingThisTrack = isPlayingAudio && playingTrackId === (currentCard?.track_id || currentCard?.id);

  const handlePressLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    swipeInfiniteCard('like');
  };

  const handlePressPass = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    swipeInfiniteCard('pass');
  };

  // Called when user completes the PhonePe/GPay slider swipe
  const handleSwipeToDeckConfirm = () => {
    if (!currentCard) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaveModalOpen(true);
  };

  const handleSaveToExistingDeck = (deckIndex) => {
    if (!currentCard) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addTrackToCustomDeck(deckIndex, currentCard);
    setSaveModalOpen(false);
    setIsCreatingDeck(false);
    setNewDeckName('');
  };

  const handleCreateAndAdd = async () => {
    const clean = newDeckName.trim();
    if (!clean || !currentCard) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await createCustomDeck(clean, currentCard);
    setSaveModalOpen(false);
    setIsCreatingDeck(false);
    setNewDeckName('');
  };

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
        <View style={styles.headerTitleCol}>
          <Text style={styles.eyebrowText}>
            {user?.name ? `MADE FOR ${user.name.toUpperCase()}` : 'MADE FOR YOU'}
          </Text>
          <Text style={styles.mainTitleText}>Your daily deck</Text>
        </View>

        {/* Subheader info counter */}
        <View style={styles.subHeaderRow}>
          <Text style={styles.subCounterText}>
            {infiniteIndex + 1} discovered today
          </Text>
          <View style={styles.refreshEndlessRow}>
            <View style={styles.liveGreenDot} />
            <Text style={styles.refreshEndlessText}>Deck refreshes endlessly</Text>
          </View>
        </View>
      </View>

      {/* 3D Multi-Layer Deck Arena */}
      <View style={styles.deckArena}>
        {isLoadingInfiniteDeck && infiniteDeck.length === 0 ? (
          <View style={styles.loadingView}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Synthesizing next batch from graph...</Text>
          </View>
        ) : currentCard ? (
          <View style={styles.stackWrapper}>
            {/* Third Stacked Card */}
            {nextCard2 && (
              <ThreeDDeckCard
                key={nextCard2.track_id || nextCard2.id}
                card={nextCard2}
                index={2}
                dragProgress={dragProgress}
              />
            )}

            {/* Second Stacked Card */}
            {nextCard1 && (
              <ThreeDDeckCard
                key={nextCard1.track_id || nextCard1.id}
                card={nextCard1}
                index={1}
                dragProgress={dragProgress}
              />
            )}

            {/* Active Top 3D Card */}
            <ThreeDDeckCard
              key={currentCard.track_id || currentCard.id}
              card={currentCard}
              index={0}
              isPlaying={isPlayingThisTrack}
              onTogglePlay={() => toggleAudioPreview(currentCard)}
              onSwipeRight={() => swipeInfiniteCard('like')}
              onSwipeLeft={() => swipeInfiniteCard('pass')}
              onAddToDeck={() => setSaveModalOpen(true)}
              dragProgress={dragProgress}
            />
          </View>
        ) : (
          <View style={styles.emptyDeckView}>
            <RotateCcw size={32} color="#FFFFFF" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyDeckTitle}>Buffer Refreshing</Text>
            <Text style={styles.emptyDeckSub}>Querying adjacent graph communities...</Text>
            <Pressable
              style={styles.refreshButton}
              onPress={() => fetchInfiniteDeck()}
            >
              <Text style={styles.refreshButtonText}>Reload Recommendations</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Bottom Section: PhonePe/Google Pay Swipe Slider + Action Buttons */}
      <View style={styles.bottomSection}>
        {/* PhonePe / Google Pay Style Slider to Add to Custom Deck */}
        <View style={styles.sliderWrapper}>
          <SwipeConfirmSlider
            label="Swipe to add to custom deck"
            accentColor="#d7ff64"
            thumbIcon={Layers}
            onConfirm={handleSwipeToDeckConfirm}
            disabled={!currentCard}
            height={52}
          />
        </View>

        {/* Quick Skip and Like Buttons */}
        <View style={styles.quickActionsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.actionCircleButton,
              styles.passActionCircle,
              pressed && styles.buttonPressed
            ]}
            onPress={handlePressPass}
            disabled={!currentCard}
          >
            <BlurView intensity={75} tint="light" style={styles.actionCircleBlur}>
              <X size={22} color="#ff817a" strokeWidth={2.6} />
            </BlurView>
          </Pressable>

          <View style={styles.swipePromptRow}>
            <Text style={styles.swipePromptText}>SWIPE CARDS OR SLIDER</Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.actionCircleButton,
              styles.likeActionCircle,
              pressed && styles.buttonPressed
            ]}
            onPress={handlePressLike}
            disabled={!currentCard}
          >
            <BlurView intensity={75} tint="light" style={styles.actionCircleBlur}>
              <Heart size={22} color="#000000" fill="#000000" strokeWidth={2.4} />
            </BlurView>
          </Pressable>
        </View>
      </View>

      {/* Custom Deck Selection Modal matching profile/App.jsx */}
      <Modal
        visible={saveModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSaveModalOpen(false);
          setIsCreatingDeck(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setSaveModalOpen(false);
              setIsCreatingDeck(false);
            }}
          />

          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
            {/* Modal Header: Song thumbnail + title/artist + close button */}
            <View style={styles.modalHeaderRow}>
              {currentCard?.cover_url && (
                <Image
                  source={{ uri: currentCard.cover_url }}
                  style={styles.modalSongImage}
                />
              )}
              <View style={styles.modalSongMeta}>
                <Text style={styles.modalEyebrow}>SAVE SONG</Text>
                <Text style={styles.modalSongTitle} numberOfLines={1}>
                  {currentCard?.title || 'Unknown Track'}
                </Text>
                <Text style={styles.modalSongArtist} numberOfLines={1}>
                  {currentCard?.artist || 'Unknown Artist'}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setSaveModalOpen(false);
                  setIsCreatingDeck(false);
                }}
                style={styles.modalCloseButton}
              >
                <X size={18} color="#FFFFFF" />
              </Pressable>
            </View>

            {/* Modal Body: Either New Deck Input OR Decks List */}
            {isCreatingDeck ? (
              <View style={styles.creatingContainer}>
                <Text style={styles.inputLabel}>Deck name</Text>
                <TextInput
                  autoFocus
                  value={newDeckName}
                  onChangeText={setNewDeckName}
                  placeholder="e.g. Late night drive"
                  placeholderTextColor="rgba(255, 255, 255, 0.3)"
                  style={styles.deckTextInput}
                />
                <View style={styles.creatingButtonsRow}>
                  <Pressable
                    onPress={() => setIsCreatingDeck(false)}
                    style={styles.backButton}
                  >
                    <Text style={styles.backButtonText}>Back</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleCreateAndAdd}
                    disabled={!newDeckName.trim()}
                    style={[
                      styles.createButton,
                      !newDeckName.trim() && styles.buttonDisabled
                    ]}
                  >
                    <Text style={styles.createButtonText}>Create & add</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                {/* "+ New deck" Button */}
                <Pressable
                  onPress={() => setIsCreatingDeck(true)}
                  style={styles.newDeckDashedButton}
                >
                  <View style={styles.newDeckPlusBadge}>
                    <Plus size={20} color="#000000" strokeWidth={3} />
                  </View>
                  <View style={styles.newDeckTextCol}>
                    <Text style={styles.newDeckTitle}>New deck</Text>
                    <Text style={styles.newDeckSubtitle}>Start a new collection</Text>
                  </View>
                </Pressable>

                <Text style={styles.decksListHeader}>YOUR DECKS</Text>

                <ScrollView style={styles.decksScrollView} showsVerticalScrollIndicator={false}>
                  {userDecks.map((deck, index) => (
                    <Pressable
                      key={deck.id || deck.name}
                      onPress={() => handleSaveToExistingDeck(index)}
                      style={({ pressed }) => [
                        styles.deckItemRow,
                        pressed && styles.deckItemPressed
                      ]}
                    >
                      <View style={styles.deckIconBadge}>
                        <Layers size={18} color="#FFFFFF" strokeWidth={2.2} />
                      </View>
                      <View style={styles.deckItemMeta}>
                        <Text style={styles.deckItemName}>{deck.name}</Text>
                        <Text style={styles.deckItemCount}>{deck.tracks?.length || 0} songs</Text>
                      </View>
                      <ChevronRight size={18} color="rgba(255, 255, 255, 0.3)" />
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}
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
    justifyContent: 'space-between',
    paddingHorizontal: 16
  },
  header: {
    paddingHorizontal: 4,
    paddingTop: 4,
    marginBottom: 6
  },
  headerTitleCol: {
    marginBottom: 6
  },
  eyebrowText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#d7ff64',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 4
  },
  mainTitleText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.6
  },
  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2
  },
  subCounterText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.45)',
    fontWeight: '600'
  },
  refreshEndlessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#d7ff64'
  },
  refreshEndlessText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#d7ff64',
    letterSpacing: 0.2
  },
  deckArena: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4
  },
  stackWrapper: {
    width: SCREEN_WIDTH - 32,
    height: Math.min(SCREEN_HEIGHT * 0.58, 480),
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingView: {
    alignItems: 'center',
    padding: 24
  },
  loadingText: {
    marginTop: 14,
    fontSize: 13.5,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '600'
  },
  emptyDeckView: {
    alignItems: 'center',
    padding: 32
  },
  emptyDeckTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6
  },
  emptyDeckSub: {
    fontSize: 13.5,
    color: 'rgba(255, 255, 255, 0.65)',
    marginBottom: 16
  },
  refreshButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 9999
  },
  refreshButtonText: {
    color: '#0E0C0B',
    fontSize: 13,
    fontWeight: '700'
  },
  bottomSection: {
    width: '100%',
    paddingTop: 8,
    gap: 12
  },
  sliderWrapper: {
    width: '100%'
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8
  },
  actionCircleButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8
  },
  passActionCircle: {
    borderColor: 'rgba(255, 129, 122, 0.45)'
  },
  likeActionCircle: {
    borderColor: 'rgba(215, 255, 100, 0.6)',
    backgroundColor: '#d7ff64'
  },
  actionCircleBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)'
  },
  swipePromptRow: {
    alignItems: 'center'
  },
  swipePromptText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.35)',
    letterSpacing: 1.4
  },
  buttonPressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.85
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 12
  },
  modalSheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#161514',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.45,
    shadowRadius: 20
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 12
  },
  modalSongImage: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
  },
  modalSongMeta: {
    flex: 1
  },
  modalEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#d7ff64',
    letterSpacing: 1.4
  },
  modalSongTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2
  },
  modalSongArtist: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.55)',
    marginTop: 1
  },
  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  newDeckDashedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderStyle: 'dashed',
    marginBottom: 16
  },
  newDeckPlusBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#d7ff64',
    justifyContent: 'center',
    alignItems: 'center'
  },
  newDeckTextCol: {
    flex: 1
  },
  newDeckTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  newDeckSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: 2
  },
  decksListHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.35)',
    letterSpacing: 1.4,
    marginBottom: 8
  },
  decksScrollView: {
    maxHeight: 220
  },
  deckItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14
  },
  deckItemPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)'
  },
  deckIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  deckItemMeta: {
    flex: 1
  },
  deckItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  deckItemCount: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: 2
  },
  creatingContainer: {
    marginTop: 4
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.55)',
    marginBottom: 8
  },
  deckTextInput: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#FFFFFF'
  },
  creatingButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14
  },
  backButton: {
    flex: 1,
    borderRadius: 9999,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 12,
    alignItems: 'center'
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  createButton: {
    flex: 1,
    borderRadius: 9999,
    backgroundColor: '#d7ff64',
    paddingVertical: 12,
    alignItems: 'center'
  },
  createButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000'
  },
  buttonDisabled: {
    opacity: 0.4
  }
});
