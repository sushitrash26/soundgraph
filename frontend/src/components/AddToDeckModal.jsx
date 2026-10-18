import React from 'react';
import { X, Plus, Disc3 } from 'lucide-react';
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
        maxWidth: '400px',
        background: '#181818',
        border: '1px solid #272727',
        borderRadius: '24px',
        padding: '24px',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.9)'
      }}>
        {/* Close Button */}
        <button
          onClick={() => setIsAddToDeckOpen(false)}
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

        <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#FFFFFF', margin: '0 0 4px' }}>Add to Deck</h3>
        <p style={{ fontSize: '12px', color: '#9B9B9B', margin: '0 0 16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          "{trackName}" — <span style={{ color: '#666666' }}>{artistName}</span>
        </p>

        {/* Decks List */}
        <div style={{
          maxHeight: '240px',
          overflowY: 'auto',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          {userDecks && userDecks.length > 0 ? (
            userDecks.map((deck) => (
              <button
                key={deck.id}
                onClick={() => addTrackToDeck(deck.id, trackId)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  background: '#1F1F1F',
                  border: '1px solid #272727',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#272727'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#1F1F1F'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background: '#272727',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Disc3 size={16} color="#a855f7" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {deck.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#666666' }}>
                      {deck.track_count || 0} tracks
                    </div>
                  </div>
                </div>

                <div style={{
                  padding: '6px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Plus size={13} />
                </div>
              </button>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 12px', color: '#666666', fontSize: '13px' }}>
              No custom decks created yet.
            </div>
          )}
        </div>

        {/* Create Deck Shortcut */}
        <button
          onClick={() => {
            setIsAddToDeckOpen(false);
            setIsDeckModalOpen(true);
          }}
          style={{
            width: '100%',
            padding: '11px',
            borderRadius: '12px',
            border: '1px dashed #383838',
            background: 'transparent',
            color: '#FFFFFF',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'border-color 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#FFFFFF'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = '#383838'}
        >
          <Plus size={14} />
          <span>Create New Deck</span>
        </button>
      </div>
    </div>
  );
}
