import { create } from 'zustand';
import axios from 'axios';

const API_BASE = 'http://localhost:8001';
axios.defaults.withCredentials = true;

export const useStore = create((set, get) => ({
  activeTab: 'landing', // defaults to landing / sign-in screen for fresh users!
  user: null,           // will be populated on login
  isCheckingAuth: true,
  authStatus: {
    spotify_connected: false,
    google_connected: false,
    has_spotify_keys: false,
    has_google_keys: false,
  },
  stats: {
    users_count: 0,
    tracks_count: 0,
    artists_count: 0,
    genres_count: 0,
    similar_to_edges_count: 0,
    listened_to_edges_count: 0,
  },
  tasteProfile: {
    top_artists: [],
    top_playlists: [],
    likes: [],
    dislikes: [],
    stats: {
      total_listened: 0,
      total_stream_plays: 0,
      total_likes: 0,
      total_dislikes: 0,
      affinity_ratio: 0
    },
    vector_metrics: {
      energy: 0.65,
      valence: 0.55,
      danceability: 0.60,
      acousticness: 0.20,
      tempo: 115.0
    },
    personas: []
  },
  deckMoodFilter: null,
  swipedIds: new Set(),
  isDeckLoadingMore: false,
  recommendations: [],
  library: { total: 0, all: [], spotify: [], youtube: [] },
  topArtists: [],
  graphData: { nodes: [], links: [] },
  selectedTrack: null,
  explanation: null,
  liveFeed: [],
  isLoading: false,
  isGdsRunning: false,
  statusMessage: '',
  isChatOpen: false,
  chatMessages: [
    {
      role: 'assistant',
      text: 'Hello. Ask me to discover music based on any mood, setting, or sound. I match candidates using your connected Spotify & YouTube graph topology.'
    }
  ],
  isChatLoading: false,
  dynamicSuggestions: [],
  currentTrack: null,
  isPlaying: false,
  sessionDepth: 1,
  isAcousticLensOpen: false,

  setIsAcousticLensOpen: (open) => set({ isAcousticLensOpen: open }),
  toggleAcousticLens: () => set({ isAcousticLensOpen: !get().isAcousticLensOpen }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),

  playTrack: (track) => {
    if (!track) return;
    set({ currentTrack: track, isPlaying: true });
    get().setSelectedTrack(track);
  },

  playNextTrack: () => {
    const { recommendations, currentTrack } = get();
    if (!recommendations || recommendations.length === 0) return;
    if (!currentTrack) {
      get().playTrack(recommendations[0]);
      return;
    }
    const curId = currentTrack.track_id || currentTrack.id;
    const idx = recommendations.findIndex(t => (t.track_id || t.id) === curId);
    const nextIdx = (idx + 1) >= recommendations.length ? 0 : idx + 1;
    get().playTrack(recommendations[nextIdx]);
  },

  playPrevTrack: () => {
    const { recommendations, currentTrack } = get();
    if (!recommendations || recommendations.length === 0) return;
    if (!currentTrack) {
      get().playTrack(recommendations[0]);
      return;
    }
    const curId = currentTrack.track_id || currentTrack.id;
    const idx = recommendations.findIndex(t => (t.track_id || t.id) === curId);
    const prevIdx = (idx - 1) < 0 ? recommendations.length - 1 : idx - 1;
    get().playTrack(recommendations[prevIdx]);
  },

  appendFrontierCandidates: (cards) => {
    if (!cards || !Array.isArray(cards) || cards.length === 0) return;
    set((state) => {
      const existingIds = new Set(state.recommendations.map(t => t.track_id || t.id));
      const fresh = cards.filter(c => !existingIds.has(c.track_id || c.id));
      if (fresh.length === 0) return state;
      return {
        recommendations: [...fresh, ...state.recommendations],
        statusMessage: `✨ Autonomous frontier exploration added ${fresh.length} fresh tracks!`
      };
    });
  },

  toggleChat: () => {
    const next = !get().isChatOpen;
    set({ isChatOpen: next });
    if (next) {
      get().fetchDynamicSuggestions();
    }
  },
  setActiveTab: (tab) => set({ activeTab: tab }),

  fetchDynamicSuggestions: async () => {
    try {
      const user = get().user;
      const uid = user?.id || 'astitva_demo_user';
      const res = await axios.get(`${API_BASE}/vibe/suggestions?user_id=${encodeURIComponent(uid)}`);
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        set({ dynamicSuggestions: res.data });
      }
    } catch (e) {
      console.warn('Failed to fetch dynamic suggestions:', e);
    }
  },

  fetchTasteProfile: async () => {
    try {
      const user = get().user;
      const uid = user?.id || 'astitva_demo_user';
      const res = await axios.get(`${API_BASE}/user/taste-profile?user_id=${encodeURIComponent(uid)}`);
      if (res.data) {
        set({ tasteProfile: res.data });
      }
    } catch (e) {
      console.error('Failed to fetch taste profile:', e);
    }
  },

  fetchLibrary: async (params = {}) => {
    try {
      const user = get().user;
      const uid = user?.id || 'astitva_demo_user';
      const q = new URLSearchParams({ user_id: uid, limit: params.limit || 60 });
      if (params.mood && params.mood !== 'all') q.append('mood', params.mood);
      if (params.sort) q.append('sort', params.sort);
      if (params.source && params.source !== 'all') q.append('source', params.source);
      if (params.search) q.append('search', params.search);

      const res = await axios.get(`${API_BASE}/library?${q.toString()}`);
      set({ library: res.data });
    } catch (e) {
      console.error('Failed to fetch library:', e);
    }
  },

  setDeckMoodFilter: async (mood) => {
    set({ deckMoodFilter: mood });
    await get().fetchRecommendations(true, mood);
  },

  fetchMoreRecommendations: async () => {
    const { isDeckLoadingMore, recommendations, swipedIds, deckMoodFilter } = get();
    if (isDeckLoadingMore) return;
    set({ isDeckLoadingMore: true });
    
    try {
      const user = get().user;
      const uid = user?.id || 'astitva_demo_user';
      const existingIds = new Set(recommendations.map(t => t.track_id || t.id));
      const allExcluded = Array.from(new Set([...Array.from(swipedIds || []), ...Array.from(existingIds)]));

      const q = new URLSearchParams({
        user_id: uid,
        limit: 10
      });
      if (allExcluded.length > 0) {
        q.append('exclude_ids', allExcluded.slice(-50).join(','));
      }
      if (deckMoodFilter && deckMoodFilter !== 'all') {
        q.append('mood', deckMoodFilter);
      }

      const res = await axios.get(`${API_BASE}/recommendations?${q.toString()}`);
      const freshCards = (res.data || []).filter(c => !existingIds.has(c.track_id || c.id));

      set((state) => ({
        recommendations: [...state.recommendations, ...freshCards],
        isDeckLoadingMore: false
      }));
    } catch (e) {
      console.warn('Failed to poll background cards:', e);
      set({ isDeckLoadingMore: false });
    }
  },

  sendFeedback: async (trackId, reward) => {
    try {
      const user = get().user;
      const uid = user?.id || 'astitva_demo_user';
      await axios.post(`${API_BASE}/recommendations/feedback`, {
        user_id: uid,
        track_id: trackId,
        reward: reward
      });

      const nextSwiped = new Set(get().swipedIds || []);
      nextSwiped.add(trackId);

      const card = get().recommendations.find(t => (t.track_id || t.id) === trackId);
      const remainingCards = get().recommendations.filter(t => (t.track_id || t.id) !== trackId);

      set((state) => {
        const nextLikes = reward > 0 
          ? [card ? { id: card.track_id || card.id, title: card.track_name || card.name, artists: card.artists || [], genres: card.genres || [], source: card.source || 'spotify', reward: 1.0, cover_url: card.cover_url || '' } : { id: trackId, title: 'Liked Track', artists: [], genres: [], reward: 1.0 }, ...state.tasteProfile.likes.filter(l => l.id !== trackId)]
          : state.tasteProfile.likes.filter(l => l.id !== trackId);

        const nextDislikes = reward < 0
          ? [card ? { id: card.track_id || card.id, title: card.track_name || card.name, artists: card.artists || [], genres: card.genres || [], source: card.source || 'spotify', reward: -1.0, cover_url: card.cover_url || '' } : { id: trackId, title: 'Disliked Track', artists: [], genres: [], reward: -1.0 }, ...state.tasteProfile.dislikes.filter(d => d.id !== trackId)]
          : state.tasteProfile.dislikes.filter(d => d.id !== trackId);

        const totalL = nextLikes.length;
        const totalD = nextDislikes.length;
        const ratio = totalL + totalD > 0 ? Math.round((totalL / (totalL + totalD)) * 100) / 100 : 0;

        return {
          swipedIds: nextSwiped,
          recommendations: remainingCards,
          statusMessage: reward > 0 ? '✨ Affinity recorded in graph (+1.0 reward)' : 'Pruned branch from discovery queue (-1.0 penalty)',
          tasteProfile: {
            ...state.tasteProfile,
            likes: nextLikes,
            dislikes: nextDislikes,
            stats: {
              ...state.tasteProfile.stats,
              total_likes: totalL,
              total_dislikes: totalD,
              affinity_ratio: ratio
            }
          }
        };
      });

      // Low-watermark continuous background polling: when remaining cards < 5, automatically fetch next batch!
      if (remainingCards.length < 5) {
        get().fetchMoreRecommendations();
      }
    } catch (e) {
      console.error('Failed to send RLHF feedback:', e);
    }
  },

  sendDwellTelemetry: async (trackId, arm = 0, dwellMs = 0, explicitAction = null) => {
    try {
      const user = get().user;
      const uid = user?.id || 'astitva_demo_user';
      await axios.post(`${API_BASE}/telemetry/dwell`, {
        user_id: uid,
        track_id: trackId,
        arm: arm,
        dwell_ms: dwellMs,
        explicit_action: explicitAction,
        session_depth: get().sessionDepth || 1,
        hour: new Date().getHours()
      });
      set((state) => ({ sessionDepth: (state.sessionDepth || 1) + 1 }));
    } catch (e) {
      console.warn('Failed to stream dwell telemetry to LinUCB bandit:', e);
    }
  },

  sendChatPrompt: async (prompt) => {
    if (!prompt.trim()) return;
    const userMsg = { role: 'user', text: prompt };
    set((state) => ({
      chatMessages: [...state.chatMessages, userMsg],
      isChatLoading: true
    }));

    try {
      const user = get().user;
      const uid = user?.id || 'astitva_demo_user';
      const res = await axios.post(`${API_BASE}/chat`, {
        user_id: uid,
        prompt: prompt
      });
      
      const assistantMsg = {
        role: 'assistant',
        text: res.data.message || 'Updated your recommendations deck matching this vibe.',
        cards: res.data.cards || []
      };

      set((state) => ({
        chatMessages: [...state.chatMessages, assistantMsg],
        recommendations: res.data.cards && res.data.cards.length > 0 ? res.data.cards : state.recommendations,
        isChatLoading: false
      }));
    } catch (e) {
      console.error('Error during chat:', e);
      set((state) => ({
        chatMessages: [...state.chatMessages, { role: 'assistant', text: 'Error querying graph for this vibe. Please try again.' }],
        isChatLoading: false
      }));
    }
  },

  sendImageVibe: async (imageBase64, mimeType = 'image/jpeg', textHint = '') => {
    if (!imageBase64) return;
    const userMsg = {
      role: 'user',
      text: textHint ? `[Visual Vibe] ${textHint}` : '[Visual Vibe] Matching visual aesthetic...',
      image: imageBase64
    };
    set((state) => ({
      chatMessages: [...state.chatMessages, userMsg],
      isChatLoading: true
    }));

    try {
      const user = get().user;
      const uid = user?.id || 'astitva_demo_user';
      const res = await axios.post(`${API_BASE}/vibe/image`, {
        user_id: uid,
        image_base64: imageBase64,
        mime_type: mimeType,
        text_hint: textHint || null
      });

      const assistantMsg = {
        role: 'assistant',
        text: res.data.message || 'Discovered tracks matching your visual atmosphere.',
        cards: res.data.cards || []
      };

      set((state) => ({
        chatMessages: [...state.chatMessages, assistantMsg],
        recommendations: res.data.cards && res.data.cards.length > 0 ? res.data.cards : state.recommendations,
        isChatLoading: false
      }));
    } catch (e) {
      console.error('Error in sendImageVibe:', e);
      set((state) => ({
        chatMessages: [...state.chatMessages, { role: 'assistant', text: 'Error analyzing visual vibe. Please try another image.' }],
        isChatLoading: false
      }));
    }
  },

  checkAuth: async () => {
    try {
      const res = await axios.get(`${API_BASE}/auth/me`);
      const { user, spotify_connected, google_connected, has_spotify_keys, has_google_keys } = res.data;
      if (user) {
        set({ 
          user, 
          activeTab: 'dashboard',
          authStatus: { spotify_connected, google_connected, has_spotify_keys, has_google_keys },
          isCheckingAuth: false
        });
        get().refreshDashboard();
      } else {
        set({ 
          authStatus: { spotify_connected, google_connected, has_spotify_keys, has_google_keys },
          isCheckingAuth: false
        });
      }
    } catch (e) {
      console.warn('Check auth error:', e);
      set({ isCheckingAuth: false });
    }
  },

  loginAsGuest: async () => {
    set({ isLoading: true, statusMessage: 'Initializing guest session...' });
    try {
      const res = await axios.post(`${API_BASE}/auth/guest-login`);
      set({ 
        user: res.data.user, 
        activeTab: 'dashboard',
        isLoading: false 
      });
      await get().refreshDashboard();
    } catch (e) {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      await axios.post(`${API_BASE}/auth/logout`);
      set({ user: null, activeTab: 'landing' });
    } catch (e) {
      console.error('Logout error:', e);
    }
  },

  refreshDashboard: async () => {
    await get().fetchStats();
    await get().fetchTasteProfile();
    await get().fetchRecommendations(true);
    await get().fetchLibrary();
    await get().fetchTopArtists();
    await get().fetchGraphData();
    await get().fetchDynamicSuggestions();
  },

  fetchStats: async () => {
    try {
      const res = await axios.get(`${API_BASE}/graph/stats`);
      set({ stats: res.data });
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  },

  fetchRecommendations: async (reset = true, customMood = null) => {
    try {
      const user = get().user;
      const uid = user?.id || 'astitva_demo_user';
      const activeMood = customMood !== null ? customMood : get().deckMoodFilter;

      const q = new URLSearchParams({
        user_id: uid,
        limit: 12
      });
      if (activeMood && activeMood !== 'all') {
        q.append('mood', activeMood);
      }

      const res = await axios.get(`${API_BASE}/recommendations?${q.toString()}`);
      const freshCards = res.data || [];

      if (reset) {
        set({ recommendations: freshCards });
        if (freshCards.length > 0 && !get().selectedTrack) {
          set({ selectedTrack: freshCards[0] });
          get().fetchExplanation(freshCards[0].track_id);
        }
      } else {
        set((state) => {
          const existingIds = new Set(state.recommendations.map(t => t.track_id || t.id));
          const deduped = freshCards.filter(c => !existingIds.has(c.track_id || c.id));
          return {
            recommendations: [...state.recommendations, ...deduped]
          };
        });
      }
    } catch (e) {
      console.error('Failed to fetch recommendations:', e);
    }
  },

  fetchTopArtists: async () => {
    try {
      const res = await axios.get(`${API_BASE}/artists/top?limit=10`);
      set({ topArtists: res.data });
    } catch (e) {
      console.error('Failed to fetch top artists:', e);
    }
  },

  fetchGraphData: async (limit = 100) => {
    try {
      const res = await axios.get(`${API_BASE}/graph/explore?limit=${limit}`);
      set({ graphData: res.data });
    } catch (e) {
      console.error('Failed to fetch graph data:', e);
    }
  },

  fetchExplanation: async (trackId) => {
    try {
      const user = get().user;
      const uid = user?.id || 'astitva_demo_user';
      const res = await axios.get(`${API_BASE}/recommendations/explain/${encodeURIComponent(trackId)}?user_id=${encodeURIComponent(uid)}`);
      set({ explanation: res.data });
    } catch (e) {
      console.error('Failed to fetch explanation:', e);
    }
  },

  setSelectedTrack: (track) => {
    set({ selectedTrack: track });
    get().fetchExplanation(track.track_id || track.id);
  },

  runGDS: async () => {
    set({ isGdsRunning: true, statusMessage: 'Executing GDS projection & NodeSimilarity...' });
    try {
      await axios.post(`${API_BASE}/graph/gds/run`);
      await get().refreshDashboard();
      set({ isGdsRunning: false, statusMessage: 'GDS complete! Graph updated.' });
    } catch (e) {
      console.error('Failed to run GDS:', e);
      set({ isGdsRunning: false, statusMessage: 'Error running GDS algorithms' });
    }
  },

  triggerDemoSeed: async () => {
    set({ isLoading: true, statusMessage: 'Seeding cross-platform Spotify & YouTube taste graph...' });
    try {
      await axios.post(`${API_BASE}/ingest/demo`);
      setTimeout(async () => {
        await get().refreshDashboard();
        set({ isLoading: false, statusMessage: 'Demo graph successfully initialized!' });
      }, 3500);
    } catch (e) {
      console.error('Failed to seed demo:', e);
      set({ isLoading: false, statusMessage: 'Seed error' });
    }
  },

  addLiveEvent: (event) => {
    set((state) => ({
      liveFeed: [event, ...state.liveFeed.slice(0, 19)],
    }));
  },
}));
