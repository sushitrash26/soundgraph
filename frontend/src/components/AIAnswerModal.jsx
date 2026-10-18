import React from 'react';
import { X, Sparkles } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function AIAnswerModal() {
  const { aiAnswer, setAiAnswer, saveCurrentCardsAsDeck, activeDeckTitle } = useStore();

  if (!aiAnswer) return null;

  const isLibraryAnswer = aiAnswer.type === 'library_answer';
  const stats = aiAnswer.stats;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(12px)'
    }}>
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '480px',
        background: '#181818',
        border: '1px solid #272727',
        borderRadius: '24px',
        padding: '28px',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.95)'
      }}>
        {/* Close Button */}
        <button
          onClick={() => setAiAnswer(null)}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: '#9B9B9B',
            cursor: 'pointer',
            padding: '4px'
          }}
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '12px',
            background: 'rgba(168, 85, 247, 0.2)',
            border: '1px solid rgba(168, 85, 247, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Sparkles size={18} color="#c084fc" />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#FFFFFF', margin: 0 }}>AI Music Intelligence</h3>
            <p style={{ fontSize: '12px', color: '#9B9B9B', margin: '2px 0 0' }}>Personalized Streaming & Taste Analytics</p>
          </div>
        </div>

        {/* Conversational Message Box */}
        <div style={{
          background: '#1F1F1F',
          border: '1px solid #272727',
          borderRadius: '16px',
          padding: '16px',
          fontSize: '14px',
          color: '#FFFFFF',
          lineHeight: '22px',
          marginBottom: '18px'
        }}>
          {aiAnswer.message.split('**').map((part, idx) =>
            idx % 2 === 1 ? <strong key={idx} style={{ color: '#c084fc', fontWeight: '700' }}>{part}</strong> : part
          )}
        </div>

        {/* Statistics & Badges */}
        {isLibraryAnswer && stats && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
            {stats.top_artists && stats.top_artists.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#666666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  Top Artists In Rotation
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {stats.top_artists.slice(0, 6).map((art, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        background: '#272727',
                        border: '1px solid #313131',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#FFFFFF'
                      }}
                    >
                      {art}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {stats.top_genres && stats.top_genres.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#666666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  Dominant Genres
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {stats.top_genres.map((g, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        background: '#1F1F1F',
                        border: '1px solid #272727',
                        fontSize: '11px',
                        color: '#9B9B9B'
                      }}
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingTop: '12px', borderTop: '1px solid #272727' }}>
          {aiAnswer.canSave && (
            <button
              onClick={() => {
                saveCurrentCardsAsDeck(activeDeckTitle || 'AI Curated Deck');
                setAiAnswer(null);
              }}
              style={{
                padding: '9px 18px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.4) 0%, rgba(6, 182, 212, 0.4) 100%)',
                border: '1px solid rgba(168, 85, 247, 0.6)',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 0 16px rgba(168, 85, 247, 0.3)'
              }}
            >
              Save as Custom Deck
            </button>
          )}

          <button
            onClick={() => setAiAnswer(null)}
            style={{
              padding: '9px 20px',
              borderRadius: '12px',
              background: '#FFFFFF',
              color: '#000000',
              border: 'none',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
