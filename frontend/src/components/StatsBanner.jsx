import React from 'react';
import { useStore } from '../store/useStore';
import { Database, Network, Music, Users, Sparkles, RefreshCw } from 'lucide-react';

export default function StatsBanner() {
  const { stats, runGDS, isGdsRunning, statusMessage } = useStore();

  return (
    <div className="glass-panel" style={{ padding: '16px 24px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(168, 85, 247, 0.15)', padding: '10px', borderRadius: '12px', color: '#c084fc' }}>
              <Music size={20} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tracks</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#fff' }}>{stats.tracks_count || 0}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '10px', borderRadius: '12px', color: '#fbbf24' }}>
              <Users size={20} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Artists</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#fff' }}>{stats.artists_count || 0}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '10px', borderRadius: '12px', color: '#34d399' }}>
              <Database size={20} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Genres</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#fff' }}>{stats.genres_count || 0}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(6, 182, 212, 0.15)', padding: '10px', borderRadius: '12px', color: '#22d3ee' }}>
              <Network size={20} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>GDS Similar Edges</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#fff' }}>{stats.similar_to_edges_count || 0}</div>
            </div>
          </div>

        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {statusMessage && (
            <span style={{ fontSize: '12px', color: 'var(--accent-cyan)' }}>
              {statusMessage}
            </span>
          )}
          <button 
            className="btn-primary" 
            onClick={runGDS} 
            disabled={isGdsRunning}
            style={{ opacity: isGdsRunning ? 0.7 : 1 }}
          >
            <RefreshCw size={16} className={isGdsRunning ? 'spin' : ''} />
            {isGdsRunning ? 'Running GDS Algorithms...' : 'Re-Run GDS Algorithms'}
          </button>
        </div>
      </div>
    </div>
  );
}
