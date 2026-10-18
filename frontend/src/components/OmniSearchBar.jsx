import React, { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, X, Play, Loader2, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { useStore } from '../store/useStore';

const PLACEHOLDER_HINTS = [
  "Search 'Freaky Friday' or any track...",
  "Ask AI: 'How many songs have I liked this month?'",
  "Search 'The Weeknd' for bridged recommendations...",
  "Ask AI: 'Make a French house deck for late night driving'...",
  "Search 'Tame Impala' or 'Daft Punk'...",
  "Ask AI: 'Who are my top artists right now?'..."
];

export default function OmniSearchBar() {
  const [query, setQuery] = useState('');
  const [hintIndex, setHintIndex] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceTimer = useRef(null);

  const {
    searchAndBridge,
    executeAskAI,
    isOmniSearching,
    playTrack
  } = useStore();

  // Rotate placeholder hints
  useEffect(() => {
    const timer = setInterval(() => {
      setHintIndex((prev) => (prev + 1) % PLACEHOLDER_HINTS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Handle input change with debounce
  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (val.trim().length >= 2) {
      setIsLoadingSuggestions(true);
      debounceTimer.current = setTimeout(async () => {
        try {
          const res = await axios.get(`http://localhost:8001/search/autocomplete?q=${encodeURIComponent(val.trim())}&limit=6`);
          setSuggestions(res.data || []);
          setIsDropdownOpen(true);
        } catch (err) {
          console.warn('Autocomplete error:', err);
        } finally {
          setIsLoadingSuggestions(false);
        }
      }, 220);
    } else {
      setSuggestions([]);
      setIsDropdownOpen(false);
      setIsLoadingSuggestions(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearchSubmit();
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  const handleSearchSubmit = () => {
    const q = query.trim();
    if (!q) return;
    setIsDropdownOpen(false);

    // If query starts with question words, route to Ask AI
    const qLower = q.toLowerCase();
    if (/^(how|what|who|why|tell|show|can you|give me)\b/.test(qLower)) {
      executeAskAI(q);
    } else {
      searchAndBridge(q);
    }
  };

  const handleAskAIClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const q = query.trim();
    if (!q) {
      inputRef.current?.focus();
      return;
    }
    setIsDropdownOpen(false);
    executeAskAI(q);
  };

  const handleSelectSuggestion = (item) => {
    setIsDropdownOpen(false);
    const searchTarget = `${item.name} ${item.artists[0] || ''}`.trim();
    setQuery(searchTarget);
    searchAndBridge(searchTarget);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto z-40">
      <div className="relative flex items-center bg-[#141414]/90 backdrop-blur-xl border border-white/10 hover:border-white/20 focus-within:border-white/30 rounded-full px-4 py-2 transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        {/* Search Icon */}
        <Search className="w-4 h-4 text-neutral-400 shrink-0 mr-3" />

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsDropdownOpen(true);
          }}
          placeholder={PLACEHOLDER_HINTS[hintIndex]}
          className="w-full bg-transparent text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none tracking-tight font-normal"
        />

        {/* Loading Spinner */}
        {(isLoadingSuggestions || isOmniSearching) && (
          <Loader2 className="w-4 h-4 text-neutral-400 animate-spin shrink-0 mr-2" />
        )}

        {/* Clear Button */}
        {query && !isOmniSearching && (
          <button
            onClick={() => {
              setQuery('');
              setSuggestions([]);
              setIsDropdownOpen(false);
              inputRef.current?.focus();
            }}
            className="p-1 text-neutral-400 hover:text-white transition-colors mr-1 shrink-0"
            title="Clear"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Ask AI Pill Button */}
        <button
          onClick={handleAskAIClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-900/40 via-indigo-900/40 to-blue-900/40 border border-purple-500/30 hover:border-purple-400/60 text-purple-200 hover:text-white text-xs font-medium shrink-0 transition-all duration-200 hover:shadow-[0_0_15px_rgba(168,85,247,0.25)] ml-1"
          title="Ask AI questions about your music or generate vibe decks"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>Ask AI</span>
        </button>

        {/* Shortcut badge */}
        {!query && (
          <kbd className="hidden sm:inline-block ml-2 px-1.5 py-0.5 text-[10px] text-neutral-400 bg-neutral-800/80 rounded border border-neutral-700/60 font-mono">
            ⌘K
          </kbd>
        )}
      </div>

      {/* Autocomplete Dropdown Popover */}
      {isDropdownOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#161616]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 border-b border-white/5 flex items-center justify-between text-[11px] text-neutral-400 font-mono px-3">
            <span>TRACK MATCHES</span>
            <span>PRESS ENTER TO SEARCH & BRIDGE</span>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
            {suggestions.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelectSuggestion(item)}
                className="group flex items-center justify-between p-2.5 hover:bg-white/[0.06] cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-neutral-800 shrink-0">
                    <img
                      src={item.cover_url || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&q=80"}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&q=80";
                      }}
                    />
                  </div>
                  <div className="min-w-0 text-left">
                    <div className="text-xs font-medium text-neutral-200 group-hover:text-white truncate">
                      {item.name}
                    </div>
                    <div className="text-[11px] text-neutral-400 truncate">
                      {item.artists ? item.artists.join(', ') : 'Artist'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.preview_url && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        playTrack({
                          track_id: item.id,
                          name: item.name,
                          artists: item.artists,
                          cover_url: item.cover_url,
                          preview_url: item.preview_url
                        });
                      }}
                      className="p-1.5 rounded-full bg-white/5 hover:bg-white/20 text-neutral-300 hover:text-white transition-colors"
                      title="Preview 30s Audio"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  )}
                  <div className="text-[11px] text-neutral-400 flex items-center gap-1 group-hover:text-purple-300 transition-colors">
                    <span>Bridge</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Ask AI Prompt from Search */}
          <div
            onClick={handleAskAIClick}
            className="p-3 bg-purple-950/20 hover:bg-purple-900/30 border-t border-purple-500/20 cursor-pointer flex items-center justify-between text-xs text-purple-300 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Ask AI: <strong>"{query}"</strong></span>
            </div>
            <span className="text-[10px] text-purple-400 font-mono">Curate AI Deck ↗</span>
          </div>
        </div>
      )}
    </div>
  );
}
