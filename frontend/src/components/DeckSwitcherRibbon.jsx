import React from 'react';
import { Sparkles, Plus, Search, X, Disc3 } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function DeckSwitcherRibbon() {
  const {
    activeDeckId,
    activeDeckTitle,
    userDecks,
    selectDeck,
    searchBanner,
    clearSearchBanner,
    setIsDeckModalOpen,
    saveCurrentCardsAsDeck
  } = useStore();

  const isSearchActive = activeDeckId?.startsWith('search_') || activeDeckId?.startsWith('search:');
  const isAiActive = activeDeckId?.startsWith('ai_') || activeDeckId?.startsWith('vibe:');

  return (
    <div style={{ width: '100%', marginBottom: '20px' }}>
      {/* Search / AI Explanation Banner if active */}
      {searchBanner && (
        <div style={{
          marginBottom: '14px',
          padding: '12px 18px',
          borderRadius: '16px',
          background: '#1F1F1F',
          border: '1px solid #313131',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13px',
          color: '#FFFFFF',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, paddingRight: '12px' }}>
            <Sparkles size={16} color="#c084fc" style={{ flexShrink: 0 }} />
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <span style={{ fontWeight: '700', color: '#FFFFFF', marginRight: '6px' }}>{searchBanner.title}:</span>
              <span style={{ color: '#9B9B9B' }}>{searchBanner.explanation}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={() => saveCurrentCardsAsDeck(searchBanner.title)}
              style={{
                padding: '6px 14px',
                borderRadius: '9999px',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(6, 182, 212, 0.3) 100%)',
                border: '1px solid rgba(168, 85, 247, 0.5)',
                color: '#FFFFFF',
                fontSize: '11.5px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Save as Deck
            </button>
            <button
              onClick={() => {
                clearSearchBanner();
                selectDeck('for_you', 'For You');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#9B9B9B',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Return to For You"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Ribbon Pills */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        overflowX: 'auto',
        padding: '2px 0 6px',
        scrollbarWidth: 'none'
      }}>
        {/* For You Default Deck */}
        <button
          onClick={() => selectDeck('for_you', 'For You')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 16px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: activeDeckId === 'for_you' ? '700' : '500',
            cursor: 'pointer',
            flexShrink: 0,
            background: activeDeckId === 'for_you' ? '#FFFFFF' : '#1F1F1F',
            color: activeDeckId === 'for_you' ? '#000000' : '#9B9B9B',
            border: activeDeckId === 'for_you' ? '1px solid #FFFFFF' : '1px solid #272727',
            boxShadow: activeDeckId === 'for_you' ? '0 0 16px rgba(255, 255, 255, 0.3)' : 'none',
            transition: 'all 0.2s cubic-bezier(0.32, 0.72, 0, 1)'
          }}
        >
          <Sparkles size={13} color={activeDeckId === 'for_you' ? '#000000' : '#a855f7'} />
          <span>For You</span>
        </button>

        {/* Temporary Search Deck Pill if Active */}
        {isSearchActive && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: '600',
            flexShrink: 0,
            background: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            color: '#93c5fd',
            boxShadow: '0 0 14px rgba(59, 130, 246, 0.2)'
          }}>
            <Search size={13} color="#60a5fa" />
            <span style={{ maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeDeckTitle}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                selectDeck('for_you', 'For You');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#93c5fd',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '2px',
                marginLeft: '2px'
              }}
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Temporary AI Vibe Deck Pill if Active */}
        {isAiActive && !isSearchActive && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: '600',
            flexShrink: 0,
            background: 'rgba(168, 85, 247, 0.15)',
            border: '1px solid rgba(168, 85, 247, 0.4)',
            color: '#e9d5ff',
            boxShadow: '0 0 14px rgba(168, 85, 247, 0.2)'
          }}>
            <Sparkles size={13} color="#c084fc" />
            <span style={{ maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeDeckTitle}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                selectDeck('for_you', 'For You');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#e9d5ff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '2px',
                marginLeft: '2px'
              }}
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* User-Created Saved Decks */}
        {userDecks && userDecks.map((deck) => {
          const isActive = activeDeckId === deck.id;
          return (
            <button
              key={deck.id}
              onClick={() => selectDeck(deck.id, deck.name)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 16px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: isActive ? '700' : '500',
                cursor: 'pointer',
                flexShrink: 0,
                background: isActive ? '#FFFFFF' : '#1F1F1F',
                color: isActive ? '#000000' : '#9B9B9B',
                border: isActive ? '1px solid #FFFFFF' : '1px solid #272727',
                boxShadow: isActive ? '0 0 16px rgba(255, 255, 255, 0.3)' : 'none',
                transition: 'all 0.2s cubic-bezier(0.32, 0.72, 0, 1)'
              }}
            >
              <Disc3 size={13} color={isActive ? '#000000' : '#9B9B9B'} />
              <span style={{ maxWidth: '130px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {deck.name}
              </span>
              {deck.track_count !== undefined && (
                <span style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: isActive ? '#E5E5E5' : '#272727',
                  color: isActive ? '#000000' : '#666666'
                }}>
                  {deck.track_count}
                </span>
              )}
            </button>
          );
        })}

        {/* New Deck Action Button */}
        <button
          onClick={() => setIsDeckModalOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '7px 14px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            flexShrink: 0,
            background: 'transparent',
            color: '#9B9B9B',
            border: '1px dashed #383838',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#FFFFFF';
            e.currentTarget.style.color = '#FFFFFF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#383838';
            e.currentTarget.style.color = '#9B9B9B';
          }}
        >
          <Plus size={13} />
          <span>New Deck</span>
        </button>
      </div>
    </div>
  );
}
