import React from 'react';
import { Sparkles, Plus, Search, Bookmark, X, Disc3 } from 'lucide-react';
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
    saveCurrentCardsAsDeck,
    statusMessage
  } = useStore();

  const isSearchActive = activeDeckId?.startsWith('search_') || activeDeckId?.startsWith('search:');
  const isAiActive = activeDeckId?.startsWith('ai_') || activeDeckId?.startsWith('vibe:');

  return (
    <div className="w-full max-w-2xl mx-auto mb-4">
      {/* Search / AI Explanation Banner if active */}
      {searchBanner && (
        <div className="mb-3 px-4 py-2.5 rounded-2xl bg-neutral-900/80 border border-white/10 backdrop-blur-xl flex items-center justify-between text-xs text-neutral-300 animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5 min-w-0 pr-3">
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
            <div className="truncate">
              <span className="font-semibold text-white mr-1.5">{searchBanner.title}:</span>
              <span className="text-neutral-400">{searchBanner.explanation}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => saveCurrentCardsAsDeck(searchBanner.title)}
              className="px-2.5 py-1 rounded-full bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/30 text-purple-200 hover:text-white text-[11px] font-medium transition-colors"
            >
              Save as Deck
            </button>
            <button
              onClick={() => {
                clearSearchBanner();
                selectDeck('for_you', 'For You');
              }}
              className="p-1 text-neutral-400 hover:text-white transition-colors"
              title="Return to For You"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Pill Switcher */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {/* For You Default Deck */}
        <button
          onClick={() => selectDeck('for_you', 'For You')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all duration-200 ${
            activeDeckId === 'for_you'
              ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.25)] font-semibold'
              : 'bg-neutral-900/60 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-white/5'
          }`}
        >
          <Sparkles className={`w-3.5 h-3.5 ${activeDeckId === 'for_you' ? 'text-black' : 'text-neutral-400'}`} />
          <span>For You</span>
        </button>

        {/* Temporary Search Deck Pill if Active */}
        {isSearchActive && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shrink-0 bg-blue-950/60 border border-blue-500/40 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.2)]">
            <Search className="w-3.5 h-3.5 text-blue-400" />
            <span className="max-w-[130px] truncate">{activeDeckTitle}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                selectDeck('for_you', 'For You');
              }}
              className="ml-1 p-0.5 hover:text-white transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Temporary AI Deck Pill if Active */}
        {isAiActive && !isSearchActive && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shrink-0 bg-purple-950/60 border border-purple-500/40 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.2)]">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="max-w-[130px] truncate">{activeDeckTitle}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                selectDeck('for_you', 'For You');
              }}
              className="ml-1 p-0.5 hover:text-white transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* User-Created Decks */}
        {userDecks && userDecks.map((deck) => {
          const isActive = activeDeckId === deck.id;
          return (
            <button
              key={deck.id}
              onClick={() => selectDeck(deck.id, deck.name)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all duration-200 ${
                isActive
                  ? 'bg-neutral-200 text-black shadow-[0_0_15px_rgba(255,255,255,0.2)] font-semibold'
                  : 'bg-neutral-900/60 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-white/5'
              }`}
            >
              <Disc3 className={`w-3.5 h-3.5 ${isActive ? 'text-black' : 'text-neutral-500'}`} />
              <span className="max-w-[140px] truncate">{deck.name}</span>
              {deck.track_count !== undefined && (
                <span className={`text-[10px] ml-0.5 ${isActive ? 'text-neutral-600' : 'text-neutral-500'}`}>
                  {deck.track_count}
                </span>
              )}
            </button>
          );
        })}

        {/* Create Deck Button */}
        <button
          onClick={() => setIsDeckModalOpen(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium shrink-0 bg-neutral-900/40 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-dashed border-white/10 hover:border-white/30 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Deck</span>
        </button>
      </div>
    </div>
  );
}
