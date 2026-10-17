import { create } from 'zustand';
import axios from 'axios';

const API_BASE = 'http://localhost:8001';

export const useStore = create((set, get) => ({
  activeTab: 'landing', // defaults to landing / sign-in screen for fresh users!
  user: null,           // will be populated on login
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

  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
  setActiveTab: (tab) => set({ activeTab: tab }),

  fetchLibrary: async () => {
    try {
      const user = get().user;
      const uid = user?.id || 'astitva_demo_user';
      const res = await axios.get(`${API_BASE}/library?user_id=${encodeURIComponent(uid)}&limit=60`);
      set({ library: res.data });
    } catch (e) {
      console.error('Failed to fetch library:', e);
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
      // Dynamically filter or update current recommendation list
      set((state) => ({
        recommendations: state.recommendations.filter(t => (t.track_id || t.id) !== trackId),
        statusMessage: reward > 0 ? '✨ Saved affinity to Graph (+1.0 reward)' : 'Pruned branch from discovery queue (-1.0 penalty)'
      }));
    } catch (e) {
      console.error('Failed to send RLHF feedback:', e);
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
        text: res.data.message || 'Updated your recommendations deck matching this vibe.'
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

  checkAuth: async () => {
    try {
      const res = await axios.get(`${API_BASE}/auth/me`);
      const { user, spotify_connected, google_connected, has_spotify_keys, has_google_keys } = res.data;
      if (user) {
        set({ 
          user, 
          activeTab: 'dashboard',
          authStatus: { spotify_connected, google_connected, has_spotify_keys, has_google_keys }
        });
        get().refreshDashboard();
      } else {
        set({ 
          authStatus: { spotify_connected, google_connected, has_spotify_keys, has_google_keys }
        });
      }
    } catch (e) {
      console.warn('Check auth error:', e);
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
    await get().fetchRecommendations();
    await get().fetchLibrary();
    await get().fetchTopArtists();
    await get().fetchGraphData();
  },

  fetchStats: async () => {
    try {
      const res = await axios.get(`${API_BASE}/graph/stats`);
      set({ stats: res.data });
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  },

  fetchRecommendations: async () => {
    try {
      const user = get().user;
      const uid = user?.id || 'astitva_demo_user';
      const res = await axios.get(`${API_BASE}/recommendations?user_id=${encodeURIComponent(uid)}&limit=10`);
      set({ recommendations: res.data });
      if (res.data.length > 0 && !get().selectedTrack) {
        set({ selectedTrack: res.data[0] });
        get().fetchExplanation(res.data[0].track_id);
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
