import React, { useState } from 'react';
import { X, Sparkles, Disc3 } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function CreateDeckModal() {
  const { isDeckModalOpen, setIsDeckModalOpen, createDeck, selectDeck } = useStore();
  const [name, setName] = useState('');
  const [mood, setMood] = useState('general');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isDeckModalOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      const newDeck = await createDeck(name.trim(), mood);
      setIsDeckModalOpen(false);
      setName('');
      if (newDeck && newDeck.id) {
        selectDeck(newDeck.id, newDeck.name);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#161616] border border-white/10 rounded-3xl p-6 shadow-2xl">
        <button
          onClick={() => setIsDeckModalOpen(false)}
          className="absolute top-5 right-5 p-1 text-neutral-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-neutral-800 flex items-center justify-center border border-white/10 text-neutral-200">
            <Disc3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Create New Deck</h3>
            <p className="text-xs text-neutral-400">Curate your own personalized stack of music</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">Deck Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Midnight Tokyo Drives"
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-white/10 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-white/30"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">Mood & Theme</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'chill', label: '🌙 Chill' },
                { id: 'focus', label: '☕ Focus' },
                { id: 'workout', label: '⚡ Energy' },
                { id: 'party', label: '🎉 Party' },
                { id: 'melancholy', label: '🌧️ Moody' },
                { id: 'general', label: '✨ Mix' }
              ].map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setMood(m.id)}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border transition-colors ${
                    mood === m.id
                      ? 'bg-white text-black border-white'
                      : 'bg-neutral-900 border-white/5 text-neutral-400 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsDeckModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)]"
            >
              {isSubmitting ? 'Creating...' : 'Create Deck'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
