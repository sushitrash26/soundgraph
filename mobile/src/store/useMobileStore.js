import { create } from 'zustand';
import axios from 'axios';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { API_BASE } from '../api/config';

WebBrowser.maybeCompleteAuthSession();

export const useMobileStore = create((set, get) => ({
  // Core Connectivity & App Navigation
  backendConnected: false,
  isConnecting: false,
  connectionError: null,
  currentTab: 'deck', // 'deck' | 'hubs' | 'lens' | 'vault'
  setCurrentTab: (tab) => set({ currentTab: tab }),

  // User & Auth State
  user: null,
  authStatus: null,
  isAuthenticated: false,
  isAuthModalOpen: false,
  openAuthModal: () => set({ isAuthModalOpen: true }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),

  // Curated Deck State
  curatedDeck: [],
  currentCardIndex: 0,
  isLoadingDeck: false,
  deckError: null,

  // Audio Playback Preview State (expo-av)
  soundInstance: null,
  playingTrackId: null,
  isPlayingAudio: false,

  // User Decks State
  userDecks: [],
  isLoadingDecks: false,

  // Platform Migration States
  activePlatformTab: 'youtube', // 'youtube' | 'spotify'
  youtubeProfile: null,
  youtubePlaylists: [],
  spotifyProfile: null,
  spotifyPlaylists: [],
  isLoadingPlatformData: false,

  // Migration Execution States
  isMigrationModalOpen: false,
  activeMigrationPlaylist: null,
  activeSourcePlatform: 'youtube',
  isResolvingTracks: false,
  migrationResolveData: null,
  isMigratingExecution: false,
  migrationResult: null,

  // --- Actions ---

  checkBackendConnection: async () => {
    try {
      set({ isConnecting: true, connectionError: null });
      const res = await axios.get(`${API_BASE}/auth/me`, { timeout: 6000 });
      if (res.data) {
        const hasUser = !!res.data.user;
        set({
          backendConnected: true,
          user: res.data.user || null,
          authStatus: res.data,
          isAuthenticated: hasUser,
          isConnecting: false
        });
        return true;
      }
    } catch (err) {
      console.warn('Backend connection error:', err.message);
      set({
        backendConnected: false,
        connectionError: `Could not reach ${API_BASE}. Ensure phone and PC are on the same Wi-Fi.`,
        isConnecting: false
      });
      return false;
    }
  },

  // Auth Operations
  loginWithGoogle: async () => {
    try {
      const res = await axios.get(`${API_BASE}/auth/google/login?redirect=false`);
      if (res.data?.login_url) {
        const result = await WebBrowser.openAuthSessionAsync(
          res.data.login_url,
          Linking.createURL('/')
        );
        // Refresh session after return
        await get().checkBackendConnection();
        return result;
      }
    } catch (e) {
      console.warn('Google login error:', e.message);
    }
  },

  loginWithSpotify: async () => {
    try {
      const res = await axios.get(`${API_BASE}/auth/spotify/login?redirect=false`);
      if (res.data?.login_url) {
        const result = await WebBrowser.openAuthSessionAsync(
          res.data.login_url,
          Linking.createURL('/')
        );
        // Refresh session after return
        await get().checkBackendConnection();
        return result;
      }
    } catch (e) {
      console.warn('Spotify login error:', e.message);
    }
  },

  loginAsGuest: async () => {
    try {
      const res = await axios.post(`${API_BASE}/auth/guest-login`);
      if (res.data?.user) {
        set({
          user: res.data.user,
          isAuthenticated: true,
          isAuthModalOpen: false
        });
        await get().fetchCuratedDeck();
      }
    } catch (e) {
      console.warn('Guest login error:', e.message);
    }
  },

  logoutUser: async () => {
    try {
      await axios.post(`${API_BASE}/auth/logout`);
    } catch (e) {
      console.warn('Logout error:', e.message);
    } finally {
      get().stopAudioPreview();
      set({
        user: null,
        isAuthenticated: false,
        isAuthModalOpen: true
      });
    }
  },

  // Curated Deck Operations
  fetchCuratedDeck: async () => {
    set({ isLoadingDeck: true, deckError: null });
    try {
      const user = get().user;
      const query = user?.id ? `?user_id=${encodeURIComponent(user.id)}&limit=20` : '?limit=20';
      const res = await axios.get(`${API_BASE}/recommendations${query}`);
      const cards = Array.isArray(res.data) ? res.data : [];
      set({
        curatedDeck: cards,
        currentCardIndex: 0,
        isLoadingDeck: false
      });
    } catch (e) {
      console.warn('Error fetching recommendations:', e.message);
      set({
        isLoadingDeck: false,
        deckError: 'Could not load recommendation feed.'
      });
    }
  },

  addCardToDeck: (card) => {
    if (!card) return;
    set((prev) => ({
      curatedDeck: [card, ...prev.curatedDeck],
      currentCardIndex: 0,
      currentTab: 'deck'
    }));
  },

  swipeDeckCard: async (direction) => {
    // direction: 'like' (+1.0) or 'dislike' (-1.0)
    const { curatedDeck, currentCardIndex, user } = get();
    const currentCard = curatedDeck[currentCardIndex];
    if (!currentCard) return;

    get().stopAudioPreview();

    // Advance to next card optimistically
    const nextIndex = currentCardIndex + 1;
    set({ currentCardIndex: nextIndex });

    // Send telemetry / bandit reward to backend
    try {
      const reward = direction === 'like' ? 1.0 : -1.0;
      await axios.post(`${API_BASE}/feedback`, {
        user_id: user?.id || undefined,
        track_id: currentCard.track_id,
        reward
      });
    } catch (e) {
      console.warn('Feedback submission error:', e.message);
    }

    // Auto-replenish deck when reaching last 3 cards
    if (nextIndex >= curatedDeck.length - 3) {
      const seenIds = curatedDeck.map(c => c.track_id).join(',');
      try {
        const query = user?.id 
          ? `?user_id=${encodeURIComponent(user.id)}&limit=15&exclude_ids=${encodeURIComponent(seenIds)}`
          : `?limit=15&exclude_ids=${encodeURIComponent(seenIds)}`;
        const res = await axios.get(`${API_BASE}/recommendations${query}`);
        if (Array.isArray(res.data) && res.data.length > 0) {
          set((prev) => ({ curatedDeck: [...prev.curatedDeck, ...res.data] }));
        }
      } catch (e) {
        console.warn('Deck replenishment error:', e.message);
      }
    }
  },

  // Audio Playback
  toggleAudioPreview: async (track) => {
    const { soundInstance, playingTrackId, isPlayingAudio } = get();

    if (soundInstance && playingTrackId === track.track_id) {
      if (isPlayingAudio) {
        soundInstance.pause();
        set({ isPlayingAudio: false });
      } else {
        soundInstance.play();
        set({ isPlayingAudio: true });
      }
      return;
    }

    // Stop existing sound
    await get().stopAudioPreview();

    if (!track.preview_url) {
      console.warn('No audio preview URL available for track');
      return;
    }

    // If it's a YouTube watch link, open native video/stream
    if (track.preview_url.includes('youtube.com') || track.preview_url.includes('youtu.be')) {
      try {
        await Linking.openURL(track.preview_url);
      } catch (err) {
        console.warn('Could not open YouTube URL:', err.message);
      }
      return;
    }

    try {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: false
        });
      } catch (modeErr) {
        // non-fatal audio mode setting
      }

      const player = createAudioPlayer(track.preview_url);
      player.play();

      set({
        soundInstance: player,
        playingTrackId: track.track_id,
        isPlayingAudio: true
      });
    } catch (e) {
      console.warn('Audio preview error:', e.message);
      set({ soundInstance: null, playingTrackId: null, isPlayingAudio: false });
    }
  },

  stopAudioPreview: async () => {
    const { soundInstance } = get();
    if (soundInstance) {
      try {
        soundInstance.pause();
        if (typeof soundInstance.release === 'function') {
          soundInstance.release();
        }
      } catch (e) {
        // ignore release error
      }
      set({ soundInstance: null, playingTrackId: null, isPlayingAudio: false });
    }
  },

  // Decks Management
  fetchUserDecks: async () => {
    set({ isLoadingDecks: true });
    try {
      const user = get().user;
      const query = user?.id ? `?user_id=${encodeURIComponent(user.id)}` : '';
      const res = await axios.get(`${API_BASE}/decks${query}`);
      set({ userDecks: Array.isArray(res.data) ? res.data : [], isLoadingDecks: false });
    } catch (e) {
      console.warn('Error fetching user decks:', e.message);
      set({ isLoadingDecks: false });
    }
  },

  // Platform Migration States
  setActivePlatformTab: (tab) => set({ activePlatformTab: tab }),

  fetchPlatformData: async (platform) => {
    set({ isLoadingPlatformData: true });
    try {
      const user = get().user;
      const queryParam = user?.id ? `?user_id=${encodeURIComponent(user.id)}&platform=${platform}` : `?platform=${platform}`;
      const [profRes, plRes] = await Promise.all([
        axios.get(`${API_BASE}/migration/profile${queryParam}`),
        axios.get(`${API_BASE}/migration/playlists${queryParam}`)
      ]);
      if (platform === 'spotify') {
        set({ spotifyProfile: profRes.data, spotifyPlaylists: plRes.data || [], isLoadingPlatformData: false });
      } else {
        set({ youtubeProfile: profRes.data, youtubePlaylists: plRes.data || [], isLoadingPlatformData: false });
      }
    } catch (e) {
      console.warn(`Error fetching ${platform} data:`, e.message);
      set({ isLoadingPlatformData: false });
    }
  },

  openMigrationModal: async (playlist, sourcePlatform) => {
    set({
      isMigrationModalOpen: true,
      activeMigrationPlaylist: playlist,
      activeSourcePlatform: sourcePlatform,
      isResolvingTracks: true,
      migrationResolveData: null,
      migrationResult: null
    });
    try {
      const targetPlatform = sourcePlatform === 'youtube' ? 'spotify' : 'youtube';
      const tracks = playlist.tracks || [];
      const res = await axios.post(`${API_BASE}/migration/resolve`, {
        tracks: tracks,
        target_platform: targetPlatform
      });
      set({ migrationResolveData: res.data, isResolvingTracks: false });
    } catch (e) {
      console.warn('Error resolving tracks:', e.message);
      set({ isResolvingTracks: false });
    }
  },

  closeMigrationModal: () => {
    set({
      isMigrationModalOpen: false,
      activeMigrationPlaylist: null,
      migrationResolveData: null,
      migrationResult: null,
      isMigratingExecution: false
    });
  },

  executeMigration: async (settings) => {
    set({ isMigratingExecution: true });
    try {
      const user = get().user;
      const res = await axios.post(`${API_BASE}/migration/execute`, {
        user_id: user?.id || undefined,
        source_platform: settings.sourcePlatform,
        target_platform: settings.targetPlatform,
        playlist_title: settings.title,
        description: settings.description,
        privacy: settings.privacy,
        tracks: settings.tracks,
        method: settings.method || 'direct'
      });
      set({ migrationResult: res.data, isMigratingExecution: false });
    } catch (e) {
      console.warn('Migration execution error:', e.message);
      set({
        migrationResult: { status: 'error', message: 'Failed to complete migration.' },
        isMigratingExecution: false
      });
    }
  }
}));
