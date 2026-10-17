import React, { useRef, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useStore } from '../store/useStore';
import { Maximize2, RotateCcw, Info } from 'lucide-react';

const NODE_COLORS = {
  Track: '#a855f7',   // Purple
  Artist: '#f59e0b',  // Amber Gold
  Genre: '#10b981',   // Emerald
  User: '#3b82f6',    // Blue
  Album: '#ec4899',   // Pink
};

export default function GraphViz({ height = 520 }) {
  const fgRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 600, height });
  const { graphData, setSelectedTrack } = useStore();

  useEffect(() => {
    function updateDimensions() {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: height || 520,
        });
      }
    }
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [height]);

  const handleNodeClick = (node) => {
    if (node.label === 'Track') {
      setSelectedTrack({
        id: node.id,
        track_id: node.id,
        track_name: node.name,
        name: node.name,
        artists: [],
        source: node.source || 'spotify',
        energy: node.energy,
        valence: node.valence,
        score: 0.95,
        reason: 'Selected from knowledge graph view',
      });
    }
    // Zoom into node
    if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(2.5, 1000);
    }
  };

  const handleResetZoom = () => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(800, 30);
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="glass-panel" 
      style={{ 
        position: 'relative', 
        overflow: 'hidden',
        height: `${height}px`,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Graph Toolbar Overlay */}
      <div style={{
        position: 'absolute',
        top: 16,
        left: 20,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        background: 'rgba(15, 17, 24, 0.75)',
        backdropFilter: 'blur(10px)',
        padding: '8px 16px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: NODE_COLORS.Track }}></span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tracks</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: NODE_COLORS.Artist }}></span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Artists</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: NODE_COLORS.Genre }}></span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Genres</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: NODE_COLORS.User }}></span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>User</span>
        </div>
      </div>

      <div style={{
        position: 'absolute',
        top: 16,
        right: 20,
        zIndex: 10,
        display: 'flex',
        gap: '8px'
      }}>
        <button 
          onClick={handleResetZoom}
          className="btn-secondary" 
          style={{ padding: '6px 12px', fontSize: '12px' }}
          title="Reset Zoom"
        >
          <RotateCcw size={14} /> Reset
        </button>
      </div>

      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeLabel={(node) => `<b>${node.name}</b> (${node.label})<br/>Source: ${node.source || 'cross-platform'}`}
        nodeColor={(node) => NODE_COLORS[node.label] || '#94a3b8'}
        nodeRelSize={6}
        nodeVal={(node) => {
          if (node.label === 'User') return 16;
          if (node.label === 'Artist') return Math.max(10, (node.pagerank || 1) * 6);
          if (node.label === 'Genre') return 8;
          return 5;
        }}
        linkColor={(link) => link.type === 'SIMILAR_TO' ? 'rgba(168, 85, 247, 0.4)' : 'rgba(255, 255, 255, 0.12)'}
        linkWidth={(link) => link.type === 'SIMILAR_TO' ? 2 : 1}
        linkDirectionalParticles={(link) => link.type === 'SIMILAR_TO' ? 2 : 0}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleColor={() => '#c084fc'}
        onNodeClick={handleNodeClick}
        backgroundColor="#090a0f"
        cooldownTicks={100}
        onEngineStop={() => {
          if (fgRef.current) fgRef.current.zoomToFit(400, 30);
        }}
      />
    </div>
  );
}
