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
  currentTab: 'recommendations', // 'recommendations' | 'lens' | 'migration' | 'profile'
  setCurrentTab: (tab) => set({ currentTab: tab }),

  // Onboarding Flow State: 'auth' | 'quiz' | 'first_deck' | 'milestone' | 'main'
  onboardingStep: 'auth',
  setOnboardingStep: (step) => set({ onboardingStep: step }),

  // Natural Vibe Setup (Step 2)
  vibeSelections: {
    routine: 'late_night',
    discovery: 'balanced',
    dealbreakers: []
  },
  setVibeSelections: (vibe) => set({ vibeSelections: vibe }),

  // Curated First Deck State (Step 3: Strictly 5 Cards)
  firstDeckCards: [],
  currentFirstDeckIndex: 0,
  firstDeckRatings: [],
  isLoadingFirstDeck: false,
  firstDeckError: null,
  onboardingMilestoneData: null,

  // Infinite Continuous Deck State (Tab 1: Smart Prefetch Buffer)
  infiniteDeck: [],
  infiniteIndex: 0,
  isLoadingInfiniteDeck: false,

  // User & Auth State
  user: null,
  authStatus: null,
  isAuthenticated: false,
  isAuthModalOpen: false,
  openAuthModal: () => set({ isAuthModalOpen: true }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),

  // Legacy Curated Deck State
  curatedDeck: [],
  currentCardIndex: 0,
  isLoadingDeck: false,
  deckError: null,

  // Audio Playback Preview State (expo-audio)
  soundInstance: null,
  playingTrackId: null,
  isPlayingAudio: false,

  // User Decks State (Custom user curated decks matching profile/App.jsx)
  userDecks: [
    {
      id: 'deck_night_drive',
      name: 'Night drive',
      tracks: [
        {
          id: 'spotify:track:starboy',
          track_id: 'spotify:track:starboy',
          title: 'After Dark',
          artist: 'Luna Vale',
          cover_url: 'https://images.unsplash.com/photo-1770335435091-75e3f07cd5e8?auto=format&fit=crop&w=900&q=88',
          image: 'https://images.unsplash.com/photo-1770335435091-75e3f07cd5e8?auto=format&fit=crop&w=900&q=88',
          tags: ['Alt pop', 'Nocturnal'],
          color: '#b263ff',
          match: 96
        },
        {
          id: 'spotify:track:midnight_city',
          track_id: 'spotify:track:midnight_city',
          title: 'Night Drive',
          artist: 'Milo Grey',
          cover_url: 'https://images.unsplash.com/photo-1608649443926-1e224443ef88?auto=format&fit=crop&w=900&q=88',
          image: 'https://images.unsplash.com/photo-1608649443926-1e224443ef88?auto=format&fit=crop&w=900&q=88',
          tags: ['Indie', 'Warm'],
          color: '#d7ff64',
          match: 87
        }
      ]
    },
    {
      id: 'deck_soft_focus',
      name: 'Soft focus',
      tracks: [
        {
          id: 'hydrated:snooze:sza',
          track_id: 'hydrated:snooze:sza',
          title: 'Soft Static',
          artist: 'Amaya Blue',
          cover_url: 'https://images.unsplash.com/photo-1543868849-ca832301484f?auto=format&fit=crop&w=900&q=88',
          image: 'https://images.unsplash.com/photo-1543868849-ca832301484f?auto=format&fit=crop&w=900&q=88',
          tags: ['R&B', 'Airy'],
          color: '#62a7ff',
          match: 89
        }
      ]
    }
  ],
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

  // Live Graph RAG User Profile & Passport State
  userProfileData: null,
  isLoadingProfile: false,

  apiBase: API_BASE,
  getApiBase: () => get().apiBase || API_BASE,

  checkBackendConnection: async () => {
    set({ isConnecting: true, connectionError: null });
    const candidates = [
      'https://soundgraph-1063139773680.europe-west1.run.app',
      get().apiBase,
      'http://192.168.0.6:8001',
      'http://127.0.0.1:8001'
    ].filter(Boolean);

    for (const base of candidates) {
      try {
        const res = await axios.get(`${base}/auth/me`, { timeout: 8000 });
        if (res.data) {
          const hasUser = !!res.data.user;
          set({
            apiBase: base,
            backendConnected: true,
            user: res.data.user || null,
            authStatus: res.data,
            isAuthenticated: hasUser,
            isConnecting: false
          });
          return true;
        }
      } catch (err) {
        // probe next
      }
    }


    set({
      backendConnected: false,
      connectionError: 'Could not reach backend on 127.0.0.1:8001 (USB) or 192.168.0.6:8001 (Wi-Fi).',
      isConnecting: false
    });
    return false;
  },

  // Auth Operations
  loginWithGoogle: async () => {
    try {
      const returnUrl = Linking.createURL('/');
      let baseUrl = get().getApiBase();
      let res;
      try {
        res = await axios.get(`${baseUrl}/auth/google/login?redirect=false&return_to=${encodeURIComponent(returnUrl)}`, { timeout: 4000 });
      } catch (err) {
        const altBase = baseUrl.includes('127.0.0.1') ? 'http://192.168.0.6:8001' : 'http://127.0.0.1:8001';
        res = await axios.get(`${altBase}/auth/google/login?redirect=false&return_to=${encodeURIComponent(returnUrl)}`, { timeout: 4000 });
        set({ apiBase: altBase });
      }

      if (res?.data?.login_url) {
        const result = await WebBrowser.openAuthSessionAsync(
          res.data.login_url,
          returnUrl
        );

        // If auth session returned a callback URL containing authorization code
        if (result?.type === 'success' && result.url) {
          await get().exchangeAuthCode(result.url, 'google');
        } else {
          await get().checkBackendConnection();
        }

        const user = get().user;
        if (user) {
          set({ onboardingStep: 'quiz', isAuthModalOpen: false });
        }
        return result;
      }
    } catch (e) {
      console.warn('Google login error:', e.message);
    }
  },

  loginWithSpotify: async () => {
    try {
      const returnUrl = Linking.createURL('/');
      let baseUrl = get().getApiBase();
      let res;
      try {
        res = await axios.get(`${baseUrl}/auth/spotify/login?redirect=false&return_to=${encodeURIComponent(returnUrl)}`, { timeout: 4000 });
      } catch (err) {
        const altBase = baseUrl.includes('127.0.0.1') ? 'http://192.168.0.6:8001' : 'http://127.0.0.1:8001';
        res = await axios.get(`${altBase}/auth/spotify/login?redirect=false&return_to=${encodeURIComponent(returnUrl)}`, { timeout: 4000 });
        set({ apiBase: altBase });
      }

      if (res?.data?.login_url) {
        const result = await WebBrowser.openAuthSessionAsync(
          res.data.login_url,
          returnUrl
        );

        if (result?.type === 'success' && result.url) {
          await get().exchangeAuthCode(result.url, 'spotify');
        } else {
          await get().checkBackendConnection();
        }

        const user = get().user;
        if (user) {
          set({ onboardingStep: 'quiz', isAuthModalOpen: false });
        }
        return result;
      }
    } catch (e) {
      console.warn('Spotify login error:', e.message);
    }
  },

  loginAsGuest: async () => {
    try {
      const res = await axios.post(`${get().getApiBase()}/auth/guest-login`);
      if (res.data?.user) {
        set({
          user: res.data.user,
          isAuthenticated: true,
          isAuthModalOpen: false,
          onboardingStep: 'quiz'
        });
      }
    } catch (e) {
      console.warn('Guest login error:', e.message);
    }
  },

  exchangeAuthCode: async (codeOrUrl, provider = 'google') => {
    try {
      set({ isConnecting: true });
      const res = await axios.post(`${get().getApiBase()}/auth/${provider}/exchange`, { code: codeOrUrl });
      if (res.data?.user) {
        set({
          user: res.data.user,
          isAuthenticated: true,
          isAuthModalOpen: false,
          onboardingStep: 'quiz',
          isConnecting: false,
        });
        return { success: true, user: res.data.user };
      }
      set({ isConnecting: false });
      return { success: false, error: 'User data not returned' };
    } catch (e) {
      const errorMsg = e.response?.data?.detail || e.message;
      console.warn(`${provider} exchange error:`, errorMsg);
      set({ isConnecting: false });
      return { success: false, error: errorMsg };
    }
  },

  triggerPcLogin: async (provider = 'google', onStatusChange) => {
    try {
      await axios.post(`${get().getApiBase()}/auth/trigger-pc-login`, { provider });
      if (onStatusChange) onStatusChange('waiting_for_pc');

      // Poll every 1.5 seconds for up to 90 seconds
      return new Promise((resolve) => {
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts++;
          await get().checkBackendConnection();
          const user = get().user;
          if (user) {
            clearInterval(interval);
            set({ onboardingStep: 'quiz', isAuthModalOpen: false });
            if (onStatusChange) onStatusChange('success');
            resolve({ success: true, user });
          } else if (attempts >= 60) {
            clearInterval(interval);
            if (onStatusChange) onStatusChange('timeout');
            resolve({ success: false, error: 'Login timed out' });
          }
        }, 1500);
      });
    } catch (e) {
      console.warn('triggerPcLogin error:', e.message);
      if (onStatusChange) onStatusChange('error');
      return { success: false, error: e.message };
    }
  },

  logoutUser: async () => {
    try {
      await axios.post(`${get().getApiBase()}/auth/logout`);
    } catch (e) {
      console.warn('Logout error:', e.message);
    } finally {
      get().stopAudioPreview();
      set({
        user: null,
        isAuthenticated: false,
        onboardingStep: 'auth',
        isAuthModalOpen: true
      });
    }
  },

  // Onboarding Phase 1: Submit Natural Vibe Quiz -> Fetches Strictly 5 Cards
  submitVibeQuiz: async (routine, discovery, dealbreakers) => {
    set({
      isLoadingFirstDeck: true,
      firstDeckError: null,
      vibeSelections: { routine, discovery, dealbreakers }
    });
    try {
      const user = get().user;
      const res = await axios.post(`${get().getApiBase()}/onboarding/first-deck`, {
        user_id: user?.id || 'demo_guest_user',
        routine: routine || 'late_night',
        mix_style: discovery || 'balanced',
        discovery: discovery || 'balanced',
        dealbreakers: dealbreakers || []
      }, { timeout: 8000 });

      const rawCards = res.data?.cards || res.data?.deck || [];
      if (Array.isArray(rawCards) && rawCards.length > 0) {
        const normalized = rawCards.map((c, i) => ({
          track_id: c.track_id || c.id || `card_${i}`,
          id: c.id || c.track_id || `card_${i}`,
          title: c.title || c.name || 'Harmonic Track',
          name: c.name || c.title || 'Harmonic Track',
          artist: c.artist || 'Featured Artist',
          cover_url: c.cover_url || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600',
          preview_url: c.preview_url || '',
          quadrant: c.quadrant || c.reason || 'Curated For Your Routine',
          reason: c.reason || c.quadrant || 'Curated For Your Routine',
          energy: c.energy ?? 0.70,
          valence: c.valence ?? 0.50
        }));

        set({
          firstDeckCards: normalized,
          currentFirstDeckIndex: 0,
          firstDeckRatings: [],
          isLoadingFirstDeck: false,
          onboardingStep: 'first_deck'
        });
        return;
      }
      throw new Error('Empty deck from server');
    } catch (err) {
      console.warn('First-deck API notice, loading curated offline anchor quadrant:', err.message);
      // High-Fidelity universal quadrant fallback ensuring user is NEVER blocked
      const fallbackDeck = [
        {
          track_id: "spotify:track:starboy",
          id: "spotify:track:starboy",
          title: "Starboy",
          name: "Starboy",
          artist: "The Weeknd",
          cover_url: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b5/92/bb/b592bb72-52e3-e756-9b26-9f56d08f47ab/16UMGIM67864.rgb.jpg/600x600bb.jpg",
          preview_url: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/11/71/d6/1171d6ad-3c96-e027-2af6-58028426588c/mzaf_15137631797407745471.plus.aac.p.m4a",
          reason: "Late-night pulse tailored to your focus zone",
          quadrant: "Late-Night Atmospheric / R&B",
          energy: 0.82,
          valence: 0.68
        },
        {
          track_id: "hydrated:snooze:sza",
          id: "hydrated:snooze:sza",
          title: "Snooze",
          name: "Snooze",
          artist: "SZA",
          cover_url: "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/62/93/13/6293132e-20ff-67ab-3d1f-96bb6797a6ba/196589564955.jpg/600x600bb.jpg",
          preview_url: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/b3/9b/ca/b39bca57-2627-1aec-77af-cbf551205394/mzaf_4430383240210492712.plus.aac.p.m4a",
          reason: "Intimate vocal atmosphere for deep evening hours",
          quadrant: "Late-Night Atmospheric / R&B",
          energy: 0.55,
          valence: 0.39
        },
        {
          track_id: "spotify:track:midnight_city",
          id: "spotify:track:midnight_city",
          title: "Midnight City",
          name: "Midnight City",
          artist: "M83",
          cover_url: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/cb/7b/a9/cb7ba903-b5f1-cc21-90db-7a81b7aa0997/724596951057.jpg/600x600bb.jpg",
          preview_url: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/24/09/79/2409794c-3d5d-af26-580e-7dc00ee4f207/mzaf_369629549966021675.plus.aac.p.m4a",
          reason: "Cinematic midnight synth progression",
          quadrant: "High-Energy Synth / Alt-Rock",
          energy: 0.78,
          valence: 0.55
        },
        {
          track_id: "spotify:track:the_less_i_know",
          id: "spotify:track:the_less_i_know",
          title: "The Less I Know The Better",
          name: "The Less I Know The Better",
          artist: "Tame Impala",
          cover_url: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a0/9a/2c/a09a2ca3-a5a6-814b-0af7-640dc0aef0aa/091012682261.jpg/600x600bb.jpg",
          preview_url: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/8b/55/f3/8b55f3a3-3204-8930-f156-82843546950e/mzaf_9370328603131228430.plus.aac.p.m4a",
          reason: "Warm bass groove with smooth nocturnal resonance",
          quadrant: "Melodic Deep Acoustic / Indie",
          energy: 0.74,
          valence: 0.78
        },
        {
          track_id: "spotify:track:blinding_lights",
          id: "spotify:track:blinding_lights",
          title: "Blinding Lights",
          name: "Blinding Lights",
          artist: "The Weeknd",
          cover_url: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/61/e7/3f/61e73f94-018d-5f50-50ec-8521952bc72e/20UM1IM11629.rgb.jpg/600x600bb.jpg",
          preview_url: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/12/73/ca/1273ca46-233a-5331-189b-25ac1d656533/mzaf_976341070785891411.plus.aac.p.m4a",
          reason: "One from our AI Agent (;",
          quadrant: "Modern Groove / Pop",
          energy: 0.80,
          valence: 0.61
        }
      ];

      set({
        firstDeckCards: fallbackDeck,
        currentFirstDeckIndex: 0,
        firstDeckRatings: [],
        isLoadingFirstDeck: false,
        onboardingStep: 'first_deck',
        firstDeckError: null
      });
    }
  },

  // Onboarding Phase 2: Swipe / Rate Card in First Deck (1 of 5 ... 5 of 5)
  rateFirstDeckCard: async (direction) => {
    // direction: 'like' (+1.0) or 'pass' (-1.0)
    const { firstDeckCards, currentFirstDeckIndex, firstDeckRatings, vibeSelections, user } = get();
    const currentCard = firstDeckCards[currentFirstDeckIndex];
    if (!currentCard) return;

    await get().stopAudioPreview();

    const reward = direction === 'like' ? 1.0 : -1.0;
    const newRating = { track_id: currentCard.track_id, reward };
    const updatedRatings = [...firstDeckRatings, newRating];
    const nextIndex = currentFirstDeckIndex + 1;

    // Send single feedback to bandit / graph
    try {
      await axios.post(`${get().getApiBase()}/feedback`, {
        user_id: user?.id || undefined,
        track_id: currentCard.track_id,
        reward
      });
    } catch (e) {
      console.warn('Single card feedback error:', e.message);
    }

    if (nextIndex >= firstDeckCards.length) {
      // Completed all 5 cards! Finalize quiz and trigger milestone flow break
      set({
        firstDeckRatings: updatedRatings,
        currentFirstDeckIndex: nextIndex,
        isLoadingFirstDeck: true
      });
      try {
        const finalizeRes = await axios.post(`${get().getApiBase()}/onboarding/finalize-quiz`, {
          user_id: user?.id || 'guest_user',
          routine: vibeSelections.routine,
          discovery: vibeSelections.discovery,
          dealbreakers: vibeSelections.dealbreakers,
          card_ratings: updatedRatings
        });

        // Preload initial infinite deck so transition into Tab 1 is instant
        get().fetchInfiniteDeck();

        set({
          onboardingMilestoneData: finalizeRes.data,
          onboardingStep: 'milestone',
          isLoadingFirstDeck: false
        });
      } catch (finErr) {
        console.warn('Finalize quiz error:', finErr.message);
        set({
          onboardingStep: 'milestone',
          isLoadingFirstDeck: false,
          onboardingMilestoneData: {
            status: 'success',
            calibrated_alpha: 0.5,
            archetype: 'Sonic Explorer'
          }
        });
      }
    } else {
      set({
        firstDeckRatings: updatedRatings,
        currentFirstDeckIndex: nextIndex
      });
    }
  },

  // Complete Onboarding and enter selected Tab
  completeOnboarding: (targetTab = 'recommendations') => {
    set({
      onboardingStep: 'main',
      currentTab: targetTab
    });
  },

  // Infinite Deck Operations (Tab 1: Recommendations) with Smart Lazy Prefetch
  fetchInfiniteDeck: async () => {
    set({ isLoadingInfiniteDeck: true });
    try {
      const user = get().user;
      const query = user?.id ? `?user_id=${encodeURIComponent(user.id)}&limit=10` : '?limit=10';
      const res = await axios.get(`${get().getApiBase()}/recommendations${query}`);
      const rawCards = Array.isArray(res.data) ? res.data : [];
      let normalized = rawCards.map((c, i) => ({
        ...c,
        id: c.track_id || c.id || `rec_${i}`,
        track_id: c.track_id || c.id || `rec_${i}`,
        title: c.track_name || c.title || c.name || 'Harmonic Track',
        name: c.track_name || c.title || c.name || 'Harmonic Track',
        artist: Array.isArray(c.artists) ? c.artists.join(', ') : (c.artist || 'Featured Artist'),
        cover_url: c.cover_url || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600',
        preview_url: c.preview_url || '',
        reason: c.reason || 'Matches your taste profile'
      }));

      if (normalized.length === 0) {
        normalized = [
          {
            track_id: "spotify:track:starboy",
            id: "spotify:track:starboy",
            title: "Starboy",
            name: "Starboy",
            artist: "The Weeknd, Daft Punk",
            cover_url: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b5/92/bb/b592bb72-52e3-e756-9b26-9f56d08f47ab/16UMGIM67864.rgb.jpg/600x600bb.jpg",
            preview_url: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/11/71/d6/1171d6ad-3c96-e027-2af6-58028426588c/mzaf_15137631797407745471.plus.aac.p.m4a",
            reason: "High-energy late night focus anchor",
            energy: 0.82,
            valence: 0.68
          },
          {
            track_id: "spotify:track:blinding_lights",
            id: "spotify:track:blinding_lights",
            title: "Blinding Lights",
            name: "Blinding Lights",
            artist: "The Weeknd",
            cover_url: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/61/e7/3f/61e73f94-018d-5f50-50ec-8521952bc72e/20UM1IM11629.rgb.jpg/600x600bb.jpg",
            preview_url: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/12/73/ca/1273ca46-233a-5331-189b-25ac1d656533/mzaf_976341070785891411.plus.aac.p.m4a",
            reason: "Atmospheric synthwave baseline",
            energy: 0.80,
            valence: 0.61
          },
          {
            track_id: "spotify:track:midnight_city",
            id: "spotify:track:midnight_city",
            title: "Midnight City",
            name: "Midnight City",
            artist: "M83",
            cover_url: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/cb/7b/a9/cb7ba903-b5f1-cc21-90db-7a81b7aa0997/724596951057.jpg/600x600bb.jpg",
            preview_url: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/24/09/79/2409794c-3d5d-af26-580e-7dc00ee4f207/mzaf_369629549966021675.plus.aac.p.m4a",
            reason: "Cinematic nocturnal soundscape",
            energy: 0.78,
            valence: 0.55
          }
        ];
      }

      set({
        infiniteDeck: normalized,
        infiniteIndex: 0,
        isLoadingInfiniteDeck: false
      });

    } catch (e) {
      console.warn('Error fetching infinite recommendations:', e.message);
      set({ isLoadingInfiniteDeck: false });
    }
  },

  // Smart Prefetch Buffer: Fetches more cards ONLY when <= 2 cards remain
  fetchMoreInfiniteRecommendations: async () => {
    const { infiniteDeck, infiniteIndex, user, isLoadingInfiniteDeck } = get();
    if (isLoadingInfiniteDeck) return;

    const remaining = infiniteDeck.length - infiniteIndex;
    if (remaining > 2) return; // Buffer is still healthy, do not spam API!

    try {
      const seenIds = infiniteDeck.map((c) => c.track_id).slice(-20).join(',');
      const query = user?.id
        ? `?user_id=${encodeURIComponent(user.id)}&limit=5&exclude_ids=${encodeURIComponent(seenIds)}`
        : `?limit=5&exclude_ids=${encodeURIComponent(seenIds)}`;
      const res = await axios.get(`${get().getApiBase()}/recommendations${query}`);
      if (Array.isArray(res.data) && res.data.length > 0) {
        const normalized = res.data.map((c, i) => ({
          ...c,
          id: c.track_id || c.id || `rec_more_${i}`,
          track_id: c.track_id || c.id || `rec_more_${i}`,
          title: c.track_name || c.title || c.name || 'Harmonic Track',
          name: c.track_name || c.title || c.name || 'Harmonic Track',
          artist: Array.isArray(c.artists) ? c.artists.join(', ') : (c.artist || 'Featured Artist'),
          cover_url: c.cover_url || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600',
          reason: c.reason || 'Matches your taste profile'
        }));
        set((prev) => ({ infiniteDeck: [...prev.infiniteDeck, ...normalized] }));
      }
    } catch (e) {
      console.warn('Prefetch error:', e.message);
    }
  },

  swipeInfiniteCard: async (direction) => {
    // direction: 'like' (+1.0) or 'pass' (-1.0)
    const { infiniteDeck, infiniteIndex, user } = get();
    const currentCard = infiniteDeck[infiniteIndex];
    if (!currentCard) return;

    await get().stopAudioPreview();

    const nextIndex = infiniteIndex + 1;
    set({ infiniteIndex: nextIndex });

    // Send telemetry to backend bandit
    try {
      const reward = direction === 'like' ? 1.0 : -1.0;
      await axios.post(`${get().getApiBase()}/feedback`, {
        user_id: user?.id || undefined,
        track_id: currentCard.track_id,
        reward
      });
    } catch (e) {
      console.warn('Feedback submission error:', e.message);
    }

    // Trigger smart lazy prefetch if buffer is running low
    get().fetchMoreInfiniteRecommendations();
  },

  // Legacy Curated Deck Operations
  fetchCuratedDeck: async () => {
    set({ isLoadingDeck: true, deckError: null });
    try {
      const user = get().user;
      const query = user?.id ? `?user_id=${encodeURIComponent(user.id)}&limit=20` : '?limit=20';
      const res = await axios.get(`${get().getApiBase()}/recommendations${query}`);
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
      currentTab: 'recommendations'
    }));
  },

  swipeDeckCard: async (direction) => {
    return get().swipeInfiniteCard(direction);
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
      const res = await axios.get(`${get().getApiBase()}/decks${query}`);
      if (Array.isArray(res.data) && res.data.length > 0) {
        const backendDecks = res.data.map((d) => ({
          id: d.id,
          name: d.name,
          tracks: Array.isArray(d.tracks) ? d.tracks : [],
          cover_url: d.cover_url || ''
        }));
        const current = get().userDecks;
        const merged = [...current];
        for (const bd of backendDecks) {
          if (!merged.some((m) => m.id === bd.id || m.name.toLowerCase() === bd.name.toLowerCase())) {
            merged.push(bd);
          }
        }
        set({ userDecks: merged, isLoadingDecks: false });
      } else {
        set({ isLoadingDecks: false });
      }
    } catch (e) {
      console.warn('Error fetching user decks:', e.message);
      set({ isLoadingDecks: false });
    }
  },

  addTrackToCustomDeck: async (deckIndexOrId, track) => {
    if (!track) return;
    const { userDecks } = get();
    const normalizedTrack = {
      id: track.track_id || track.id || `track_${Date.now()}`,
      track_id: track.track_id || track.id || `track_${Date.now()}`,
      title: track.title || track.name || track.track_name || 'Untitled Song',
      artist: track.artist || (Array.isArray(track.artists) ? track.artists.join(', ') : 'Featured Artist'),
      cover_url: track.cover_url || track.image || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600',
      image: track.cover_url || track.image || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600',
      preview_url: track.preview_url || '',
      tags: track.tags || ['Curated', 'Deck'],
      color: track.color || '#d7ff64',
      match: track.match || 92
    };

    let targetDeckId = null;
    const updated = userDecks.map((deck, idx) => {
      const isMatch =
        (typeof deckIndexOrId === 'number' && idx === deckIndexOrId) ||
        deck.id === deckIndexOrId ||
        deck.name.toLowerCase() === String(deckIndexOrId).toLowerCase();

      if (isMatch) {
        targetDeckId = deck.id;
        const exists = deck.tracks.some(
          (t) =>
            (t.id && t.id === normalizedTrack.id) ||
            (t.title && t.title.toLowerCase() === normalizedTrack.title.toLowerCase())
        );
        if (exists) return deck;
        return {
          ...deck,
          tracks: [normalizedTrack, ...deck.tracks]
        };
      }
      return deck;
    });

    set({ userDecks: updated });

    if (targetDeckId) {
      try {
        await axios.post(`${get().getApiBase()}/decks/${targetDeckId}/tracks`, {
          track_id: normalizedTrack.track_id
        });
      } catch (e) {
        // non-fatal offline deck sync
      }
    }
  },

  createCustomDeck: async (deckName, initialTrack = null) => {
    const cleanName = (deckName || '').trim();
    if (!cleanName) return null;

    const newDeckId = `deck_${Date.now()}`;
    const initialTracks = [];
    if (initialTrack) {
      initialTracks.push({
        id: initialTrack.track_id || initialTrack.id || `track_${Date.now()}`,
        track_id: initialTrack.track_id || initialTrack.id || `track_${Date.now()}`,
        title: initialTrack.title || initialTrack.name || 'Untitled Song',
        artist: initialTrack.artist || 'Featured Artist',
        cover_url: initialTrack.cover_url || initialTrack.image || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600',
        image: initialTrack.cover_url || initialTrack.image || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600',
        preview_url: initialTrack.preview_url || '',
        tags: initialTrack.tags || ['New Deck'],
        color: '#d7ff64',
        match: 95
      });
    }

    const newDeck = {
      id: newDeckId,
      name: cleanName,
      tracks: initialTracks,
      cover_url: initialTracks[0]?.cover_url || ''
    };

    set((prev) => ({
      userDecks: [newDeck, ...prev.userDecks]
    }));

    try {
      const user = get().user;
      await axios.post(`${get().getApiBase()}/decks`, {
        user_id: user?.id || undefined,
        name: cleanName,
        mood: 'custom',
        track_ids: initialTracks.map((t) => t.track_id)
      });
    } catch (e) {
      // non-fatal offline sync
    }

    return newDeck;
  },

  // Platform Migration States
  setActivePlatformTab: (tab) => set({ activePlatformTab: tab }),

  fetchPlatformData: async (platform) => {
    set({ isLoadingPlatformData: true });
    try {
      const user = get().user;
      const queryParam = user?.id ? `?user_id=${encodeURIComponent(user.id)}&platform=${platform}` : `?platform=${platform}`;
      const [profRes, plRes] = await Promise.all([
        axios.get(`${get().getApiBase()}/migration/profile${queryParam}`),
        axios.get(`${get().getApiBase()}/migration/playlists${queryParam}`)
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
      const res = await axios.post(`${get().getApiBase()}/migration/resolve`, {
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
      const res = await axios.post(`${get().getApiBase()}/migration/execute`, {
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
      // Refresh profile migration metrics in background
      get().fetchUserProfile();
    } catch (e) {
      console.warn('Migration execution error:', e.message);
      set({
        migrationResult: { status: 'error', message: 'Failed to complete migration.' },
        isMigratingExecution: false
      });
    }
  },

  // Live Graph RAG Profile & Passport Fetch
  fetchUserProfile: async () => {
    set({ isLoadingProfile: true });
    try {
      const user = get().user;
      const queryParam = user?.id ? `?user_id=${encodeURIComponent(user.id)}` : '';
      const res = await axios.get(`${get().getApiBase()}/profile/me${queryParam}`, { timeout: 6000 });
      if (res.data?.status === 'success') {
        set({ userProfileData: res.data, isLoadingProfile: false });
      } else {
        set({ isLoadingProfile: false });
      }
    } catch (e) {
      console.warn('Error fetching user profile:', e.message);
      set({ isLoadingProfile: false });
    }
  }
}));
