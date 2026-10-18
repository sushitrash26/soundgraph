import React from 'react';
import { X, Plus, Disc3, Check } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function AddToDeckModal() {
  const {
    isAddToDeckOpen,
    setIsAddToDeckOpen,
    trackToAddToDeck,
    userDecks,
    addTrackToDeck,
    setIsDeckModalOpen
  } = useStore();

  if (!isAddToDeckOpen || !trackToAddToDeck) return null;

  const trackId = trackToAddToDeck.track_id || trackToAddToDeck.id;
  const trackName = trackToAddToDeck.track_name || trackToAddToDeck.name;
  const artistName = trackToAddToDeck.artists ? trackToAddToDeck.artists.join(', ') : 'Artist';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-[#161616] border border-white/10 rounded-3xl p-6 shadow-2xl">
        <button
          onClick={() => setIsAddToDeckOpen(false)}
          className="absolute top-5 right-5 p-1 text-neutral-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-base font-semibold text-white mb-1">Add to Deck</h3>
        <p className="text-xs text-neutral-400 truncate mb-4">
          "{trackName}" — <span className="text-neutral-500">{artistName}</span>
        </p>

        <div className="space-y-2 max-h-60 overflow-y-auto mb-4 divide-y divide-white/5">
          {userDecks && userDecks.length > 0 ? (
            userDecks.map((deck) => (
              <button
                key={deck.id}
                onClick={() => addTrackToDeck(deck.id, trackId)}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.06] transition-colors text-left group"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0 border border-white/5">
                    <Disc3 className="w-4 h-4 text-neutral-400 group-hover:text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-neutral-200 group-hover:text-white truncate">
                      {deck.name}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      {deck.track_count || 0} tracks
                    </div>
                  </div>
                </div>
                <div className="p-1 rounded-full bg-white/5 group-hover:bg-white text-neutral-400 group-hover:text-black transition-colors shrink-0">
                  <Plus className="w-3.5 h-3.5" />
                </div>
              </button>
            ))
          ) : (
            <div className="py-6 text-center text-xs text-neutral-500">
              No decks created yet.
            </div>
          )}
        </div>

        <button
          onClick={() => {
            setIsAddToDeckOpen(false);
            setIsDeckModalOpen(true);
          }}
          className="w-full py-2.5 rounded-xl border border-dashed border-white/15 hover:border-white/30 text-xs font-medium text-neutral-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create New Deck</span>
        </button>
      </div>
    </div>
  );
}
