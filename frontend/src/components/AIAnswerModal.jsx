import React from 'react';
import { X, Sparkles, CheckCircle2 } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function AIAnswerModal() {
  const { aiAnswer, setAiAnswer, saveCurrentCardsAsDeck, activeDeckTitle } = useStore();

  if (!aiAnswer) return null;

  const isLibraryAnswer = aiAnswer.type === 'library_answer';
  const stats = aiAnswer.stats;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#141414] border border-white/10 rounded-3xl p-6 shadow-[0_25px_60px_rgba(0,0,0,0.8)]">
        <button
          onClick={() => setAiAnswer(null)}
          className="absolute top-5 right-5 p-1 text-neutral-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-purple-950/60 border border-purple-500/30 text-purple-300">
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">AI Music Intelligence</h3>
            <p className="text-[11px] text-neutral-400">Personalized Streaming & Taste Analytics</p>
          </div>
        </div>

        {/* Message */}
        <div className="text-sm text-neutral-200 leading-relaxed mb-5 bg-neutral-900/60 p-4 rounded-2xl border border-white/5 font-normal">
          {aiAnswer.message.split('**').map((part, idx) =>
            idx % 2 === 1 ? <strong key={idx} className="font-semibold text-white">{part}</strong> : part
          )}
        </div>

        {/* Library Stats Badges if present */}
        {isLibraryAnswer && stats && (
          <div className="space-y-3 mb-5">
            {stats.top_artists && stats.top_artists.length > 0 && (
              <div>
                <div className="text-[11px] font-mono text-neutral-400 mb-1.5 uppercase tracking-wider">Top Artists In Library</div>
                <div className="flex flex-wrap gap-1.5">
                  {stats.top_artists.slice(0, 6).map((art, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-full bg-neutral-800/80 border border-white/5 text-xs text-neutral-300">
                      {art}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {stats.top_genres && stats.top_genres.length > 0 && (
              <div>
                <div className="text-[11px] font-mono text-neutral-400 mb-1.5 uppercase tracking-wider">Core Genres</div>
                <div className="flex flex-wrap gap-1.5">
                  {stats.top_genres.map((g, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-full bg-neutral-800/40 border border-white/5 text-xs text-neutral-400">
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
          {aiAnswer.canSave && (
            <button
              onClick={() => {
                saveCurrentCardsAsDeck(activeDeckTitle || 'AI Curated Deck');
                setAiAnswer(null);
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors"
            >
              Save as Custom Deck
            </button>
          )}
          <button
            onClick={() => setAiAnswer(null)}
            className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
