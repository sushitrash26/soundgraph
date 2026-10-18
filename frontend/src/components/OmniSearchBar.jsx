import React, { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, X, Play, Loader2, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { useStore } from '../store/useStore';

const PLACEHOLDER_HINTS = [
  "Search 'Freaky Friday', 'Starboy', or any song...",
  "Ask AI: 'How many songs have I liked in the past month?'",
  "Search 'The Weeknd' for bridged recommendations...",
  "Ask AI: 'Make a French house deck for driving at night'...",
  "Search 'Tame Impala' or 'Daft Punk'...",
  "Ask AI: 'Who are my top artists right now?'..."
];

export default function OmniSearchBar() {
  const [query, setQuery] = useState('');
  const [hintIndex, setHintIndex] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceTimer = useRef(null);

  const {
    searchAndBridge,
    executeAskAI,
    isOmniSearching,
    playTrack
  } = useStore();

  useEffect(() => {
    const timer = setInterval(() => {
      setHintIndex((prev) => (prev + 1) % PLACEHOLDER_HINTS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

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

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (val.trim().length >= 2) {
      setIsLoadingSuggestions(true);
      debounceTimer.current = setTimeout(async () => {
        try {
          const res = await axios.get(`http://localhost:8001/search/autocomplete?q=${encodeURIComponent(val.trim())}&limit=5`);
          setSuggestions(res.data || []);
          setIsDropdownOpen(true);
        } catch (err) {
          console.warn('Autocomplete error:', err);
        } finally {
          setIsLoadingSuggestions(false);
        }
      }, 200);
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
    <div ref={containerRef} style={{ position: 'relative', width: '100%', maxWidth: '580px', margin: '0 auto', zIndex: 90 }}>
      {/* Omni-Bar Container */}
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        background: '#181818',
        borderRadius: '9999px',
        border: '1px solid',
        borderColor: isFocused ? '#a855f7' : '#272727',
        padding: '6px 12px 6px 14px',
        boxShadow: isFocused ? '0 0 20px rgba(168, 85, 247, 0.25), 0 8px 24px rgba(0,0,0,0.6)' : '0 8px 24px rgba(0,0,0,0.5)',
        transition: 'all 0.2s cubic-bezier(0.32, 0.72, 0, 1)'
      }}>
        {/* Search Icon */}
        <Search size={15} color={isFocused ? '#a855f7' : '#9B9B9B'} style={{ flexShrink: 0, marginRight: '10px' }} />

        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsFocused(true);
            if (suggestions.length > 0) setIsDropdownOpen(true);
          }}
          onBlur={() => setIsFocused(false)}
          placeholder={PLACEHOLDER_HINTS[hintIndex]}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#FFFFFF',
            fontSize: '13px',
            fontFamily: 'var(--font-main)',
            fontWeight: '500',
            letterSpacing: '-0.01em',
            padding: 0
          }}
        />

        {/* Loading Spinner */}
        {(isLoadingSuggestions || isOmniSearching) && (
          <div style={{ display: 'flex', alignItems: 'center', marginRight: '8px' }}>
            <Loader2 size={14} color="#a855f7" className="spin" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
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
            style={{
              background: 'none',
              border: 'none',
              color: '#9B9B9B',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '6px'
            }}
            title="Clear Search"
          >
            <X size={13} />
          </button>
        )}

        {/* Ask AI Pill Button */}
        <button
          onClick={handleAskAIClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '9999px',
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(6, 182, 212, 0.25) 100%)',
            border: '1px solid rgba(168, 85, 247, 0.45)',
            color: '#FFFFFF',
            fontSize: '11.5px',
            fontWeight: '700',
            cursor: 'pointer',
            flexShrink: 0,
            boxShadow: '0 0 12px rgba(168, 85, 247, 0.2)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(168, 85, 247, 0.4) 0%, rgba(6, 182, 212, 0.4) 100%)';
            e.currentTarget.style.boxShadow = '0 0 18px rgba(168, 85, 247, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(6, 182, 212, 0.25) 100%)';
            e.currentTarget.style.boxShadow = '0 0 12px rgba(168, 85, 247, 0.2)';
          }}
          title="Ask AI questions or generate vibe decks"
        >
          <Sparkles size={13} color="#c084fc" />
          <span>Ask AI</span>
        </button>
      </div>

      {/* Autocomplete Dropdown Popover */}
      {isDropdownOpen && suggestions.length > 0 && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          right: 0,
          background: '#181818',
          borderRadius: '16px',
          border: '1px solid #313131',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.9)',
          overflow: 'hidden',
          zIndex: 1000
        }}>
          {/* Header Row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 14px',
            borderBottom: '1px solid #272727',
            fontSize: '10.5px',
            fontFamily: 'var(--font-mono)',
            color: '#666666',
            letterSpacing: '0.05em'
          }}>
            <span>MATCHES</span>
            <span>PRESS ENTER TO BRIDGE TASTE</span>
          </div>

          {/* Results List */}
          <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
            {suggestions.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelectSuggestion(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 14px',
                  borderBottom: '1px solid #222222',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#222222'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, paddingRight: '8px' }}>
                  {/* Constrained 38x38 Thumbnail */}
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    background: '#272727',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <img
                      src={item.cover_url || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&q=80"}
                      alt={item.name}
                      style={{
                        width: '38px',
                        height: '38px',
                        objectFit: 'cover',
                        display: 'block'
                      }}
                      onError={(e) => {
                        e.target.src = "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&q=80";
                      }}
                    />
                  </div>

                  {/* Title & Artist */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9B9B9B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.artists ? item.artists.join(', ') : 'Artist'}
                    </div>
                  </div>
                </div>

                {/* Right Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
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
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        background: '#272727',
                        border: '1px solid #313131',
                        color: '#FFFFFF',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Play 30s Preview"
                    >
                      <Play size={12} fill="#FFFFFF" />
                    </button>
                  )}

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#c084fc',
                    background: 'rgba(168, 85, 247, 0.12)',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid rgba(168, 85, 247, 0.3)'
                  }}>
                    <span>Bridge</span>
                    <ArrowRight size={11} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Ask AI Footer */}
          <div
            onClick={handleAskAIClick}
            style={{
              padding: '10px 14px',
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)',
              borderTop: '1px solid #272727',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#e9d5ff' }}>
              <Sparkles size={13} color="#c084fc" />
              <span>Ask AI about "<strong>{query}</strong>"</span>
            </div>
            <span style={{ fontSize: '11px', color: '#c084fc', fontFamily: 'var(--font-mono)' }}>Curate Deck ↗</span>
          </div>
        </div>
      )}
    </div>
  );
}
