import React, { useState } from 'react';
import { X, Disc3 } from 'lucide-react';
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
        maxWidth: '440px',
        background: '#181818',
        border: '1px solid #272727',
        borderRadius: '24px',
        padding: '28px',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.9)'
      }}>
        {/* Close Button */}
        <button
          onClick={() => setIsDeckModalOpen(false)}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '14px',
            background: '#272727',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #313131'
          }}>
            <Disc3 size={20} color="#a855f7" />
          </div>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#FFFFFF', margin: 0 }}>Create New Deck</h3>
            <p style={{ fontSize: '12px', color: '#9B9B9B', margin: '2px 0 0' }}>Curate a personalized stack of music</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#FFFFFF', marginBottom: '8px' }}>
              Deck Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Midnight Tokyo Drives"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '12px',
                background: '#1F1F1F',
                border: '1px solid #272727',
                color: '#FFFFFF',
                fontSize: '13px',
                fontFamily: 'var(--font-main)',
                outline: 'none'
              }}
              autoFocus
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#FFFFFF', marginBottom: '8px' }}>
              Mood Theme
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {[
                { id: 'chill', label: '🌙 Chill' },
                { id: 'focus', label: '☕ Focus' },
                { id: 'workout', label: '⚡ Energy' },
                { id: 'party', label: '🎉 Party' },
                { id: 'melancholy', label: '🌧️ Moody' },
                { id: 'general', label: '✨ Mix' }
              ].map((m) => {
                const isSelected = mood === m.id;
                return (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => setMood(m.id)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: isSelected ? '700' : '500',
                      cursor: 'pointer',
                      background: isSelected ? '#FFFFFF' : '#1F1F1F',
                      color: isSelected ? '#000000' : '#9B9B9B',
                      border: isSelected ? '1px solid #FFFFFF' : '1px solid #272727',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px' }}>
            <button
              type="button"
              onClick={() => setIsDeckModalOpen(false)}
              style={{
                padding: '9px 18px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '600',
                background: 'none',
                border: 'none',
                color: '#9B9B9B',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              style={{
                padding: '9px 22px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '700',
                background: '#FFFFFF',
                color: '#000000',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 0 16px rgba(255, 255, 255, 0.25)',
                opacity: (!name.trim() || isSubmitting) ? 0.5 : 1
              }}
            >
              {isSubmitting ? 'Creating...' : 'Create Deck'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
