import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import GraphViz from '../components/GraphViz';
import { Network, GitFork, Trophy, ArrowRight, Search, Sparkles } from 'lucide-react';
import axios from 'axios';

export default function Explorer() {
  const { topArtists, fetchTopArtists } = useStore();
  const [sourceArtist, setSourceArtist] = useState('Daft Punk');
  const [targetArtist, setTargetArtist] = useState('Arijit Singh');
  const [pathResult, setPathResult] = useState(null);
  const [isSolving, setIsSolving] = useState(false);

  useEffect(() => {
    fetchTopArtists();
    handleFindBridge('Daft Punk', 'Arijit Singh');
  }, []);

  const handleFindBridge = async (src = sourceArtist, tgt = targetArtist) => {
    setIsSolving(true);
    try {
      const res = await axios.get(`http://localhost:8001/shortest-path?source=${encodeURIComponent(src)}&target=${encodeURIComponent(tgt)}`);
      setPathResult(res.data);
    } catch (e) {
      console.error('Failed to solve shortest path:', e);
    } finally {
      setIsSolving(false);
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#fff', marginBottom: '6px' }}>
          Graph Explorer & Topology Analytics
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Deep-dive into Neo4j PageRank influence metrics and compute Dijkstra shortest-path taste bridges between artists.
        </p>
      </div>

      {/* Taste Bridge Solver */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <GitFork size={20} color="var(--accent-purple)" />
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>
            Dijkstra Taste Bridge Path Finder
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>Source Artist</label>
            <input 
              type="text" 
              value={sourceArtist} 
              onChange={(e) => setSourceArtist(e.target.value)}
              placeholder="e.g. Daft Punk"
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#fff',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ paddingTop: '20px', color: 'var(--text-dim)' }}>
            <ArrowRight size={20} />
          </div>

          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>Target Artist</label>
            <input 
              type="text" 
              value={targetArtist} 
              onChange={(e) => setTargetArtist(e.target.value)}
              placeholder="e.g. Arijit Singh"
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#fff',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ paddingTop: '20px' }}>
            <button 
              className="btn-primary" 
              onClick={() => handleFindBridge()}
              disabled={isSolving}
              style={{ height: '42px' }}
            >
              <Sparkles size={16} />
              {isSolving ? 'Solving...' : 'Compute Shortest Path'}
            </button>
          </div>
        </div>

        {/* Shortest Path Visualization */}
        {pathResult && pathResult.path_nodes?.length > 0 && (
          <div style={{ 
            background: 'rgba(0,0,0,0.3)', 
            padding: '16px', 
            borderRadius: '10px',
            border: '1px solid rgba(168, 85, 247, 0.2)' 
          }}>
            <div style={{ fontSize: '12px', color: 'var(--accent-purple)', fontWeight: '600', marginBottom: '10px' }}>
              Optimal Taste Bridge · Hop Distance: {pathResult.path_length}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {pathResult.path_nodes.map((n, idx) => (
                <React.Fragment key={idx}>
                  <div style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: n.label === 'Artist' ? 'rgba(245, 158, 11, 0.15)' : (n.label === 'User' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(168, 85, 247, 0.15)'),
                    border: `1px solid ${n.label === 'Artist' ? 'rgba(245, 158, 11, 0.4)' : (n.label === 'User' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(168, 85, 247, 0.4)')}`,
                    fontSize: '13px',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                      [{n.label}]
                    </span>
                    <b>{n.name}</b>
                  </div>
                  {idx < pathResult.path_nodes.length - 1 && (
                    <span style={{ color: 'var(--text-dim)', fontSize: '14px' }}>→</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Grid: Graph Canvas + PageRank Leaderboard */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)',
        gap: '24px'
      }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#fff', marginBottom: '12px' }}>
            Full Taste Graph
          </h3>
          <GraphViz height={580} />
        </div>

        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Trophy size={20} color="var(--accent-amber)" />
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>
              Top Artists by PageRank
            </h3>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-dim)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 8px' }}>Rank</th>
                  <th style={{ padding: '10px 8px' }}>Artist</th>
                  <th style={{ padding: '10px 8px' }}>PageRank</th>
                  <th style={{ padding: '10px 8px' }}>Plays</th>
                </tr>
              </thead>
              <tbody>
                {topArtists.map((art, idx) => (
                  <tr 
                    key={idx}
                    style={{ 
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      background: idx === 0 ? 'rgba(245, 158, 11, 0.05)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '12px 8px', color: 'var(--text-dim)' }}>
                      #{idx + 1}
                    </td>
                    <td style={{ padding: '12px 8px', fontWeight: '600', color: '#fff' }}>
                      {art.name}
                    </td>
                    <td style={{ padding: '12px 8px', color: 'var(--accent-cyan)' }}>
                      {art.pagerank ? Number(art.pagerank).toFixed(3) : '0.150'}
                    </td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>
                      {art.total_plays || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
