import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Play, Sparkles, ChevronDown, ChevronUp, Music, Radio } from 'lucide-react';

export default function RecommendCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const { selectedTrack, setSelectedTrack, explanation } = useStore();

  const isSelected = selectedTrack?.track_id === item.track_id;

  const handleCardClick = () => {
    setSelectedTrack(item);
  };

  const isCurrentExplanation = isSelected && explanation;
  const rawId = item.track_id || item.id || '';
  let thumb = item.cover_url;
  if (!thumb && rawId.includes('youtube:video:')) {
    thumb = `https://img.youtube.com/vi/${rawId.replace('youtube:video:', '')}/hqdefault.jpg`;
  }

  return (
    <div 
      className={`glass-card ${isSelected ? 'selected' : ''}`}
      onClick={handleCardClick}
      style={{
        padding: '16px',
        marginBottom: '12px',
        cursor: 'pointer',
        borderLeft: isSelected ? '4px solid var(--accent-purple)' : '1px solid rgba(255,255,255,0.06)',
        background: isSelected ? 'rgba(168, 85, 247, 0.08)' : 'rgba(255,255,255,0.02)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        {thumb && (
          <img
            src={thumb}
            alt={item.track_name}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              objectFit: 'cover',
              border: '1px solid rgba(255,255,255,0.1)',
              flexShrink: 0
            }}
          />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className={`badge ${item.source === 'spotify' ? 'badge-spotify' : 'badge-youtube'}`}>
              {item.source === 'spotify' ? 'Spotify' : 'YouTube Music'}
            </span>
            <span className="badge badge-score">
              {Math.round((item.score || 0.85) * 100)}% Match
            </span>
            {item.transition_flow && (
              <span className="badge" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#38bdf8', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
                🌊 {item.transition_flow}
              </span>
            )}
          </div>

          <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
            {item.track_name}
          </h4>

          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {(item.artists || []).join(', ') || 'Various Artists'}
          </p>
        </div>

        <button 
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
            if (!isSelected) setSelectedTrack(item);
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            padding: '4px',
          }}
          title="Explain Recommendation"
        >
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {/* Genres / Tags */}
      {item.genres && item.genres.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
          {item.genres.slice(0, 3).map((g, idx) => (
            <span key={idx} style={{ 
              fontSize: '11px', 
              color: 'var(--text-dim)', 
              background: 'rgba(255,255,255,0.04)', 
              padding: '2px 8px', 
              borderRadius: '4px' 
            }}>
              #{g}
            </span>
          ))}
        </div>
      )}

      {/* Expandable Explanation Details */}
      {expanded && (
        <div style={{ 
          marginTop: '12px', 
          padding: '12px', 
          background: 'rgba(0, 0, 0, 0.3)', 
          borderRadius: '8px',
          border: '1px solid rgba(168, 85, 247, 0.2)',
          fontSize: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-purple)', fontWeight: '600', marginBottom: '6px' }}>
            <Sparkles size={14} />
            Graph Explanation
          </div>
          <p style={{ color: 'var(--text-main)', marginBottom: '8px', lineHeight: '1.4' }}>
            {item.reason}
          </p>
          {isCurrentExplanation && (
            <div style={{ color: 'var(--text-muted)' }}>
              <div><b>Shared Vibes:</b> {explanation.shared_genres?.join(', ') || 'Electronic, Indie'}</div>
              <div><b>Topological Affinity:</b> {Math.round(explanation.similarity_score * 100)}%</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
