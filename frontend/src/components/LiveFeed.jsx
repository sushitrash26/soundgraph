import React, { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Radio, Zap, CheckCircle2 } from 'lucide-react';

export default function LiveFeed() {
  const { liveFeed, addLiveEvent } = useStore();

  useEffect(() => {
    let ws;
    try {
      ws = new WebSocket('ws://localhost:8001/ws/live');

      ws.onopen = () => {
        addLiveEvent({
          time: new Date().toLocaleTimeString(),
          title: 'WebSocket Connected',
          detail: 'Listening for real-time Neo4j graph mutations and recommendations...',
          type: 'system',
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          addLiveEvent({
            time: new Date().toLocaleTimeString(),
            title: data.status || data.type || 'Event',
            detail: data.message || data.stage || JSON.stringify(data),
            type: data.type || 'info',
          });
        } catch (e) {
          console.log('WS message:', event.data);
        }
      };

      ws.onerror = (e) => {
        console.warn('WS error', e);
      };
    } catch (err) {
      console.warn('WebSocket connection error:', err);
    }

    return () => {
      if (ws) ws.close();
    };
  }, []);

  return (
    <div className="glass-panel" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Radio size={18} color="var(--accent-purple)" className="pulse" />
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#fff' }}>Live Graph Stream</h3>
        </div>
        <span style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }}></span> Live
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {liveFeed.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', fontSize: '13px', textAlign: 'center', marginTop: '30px' }}>
            Streaming listening events & GDS graph triggers...
          </div>
        ) : (
          liveFeed.map((evt, idx) => (
            <div 
              key={idx} 
              style={{
                padding: '10px 12px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                fontSize: '12px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-dim)', marginBottom: '3px', fontSize: '10px' }}>
                <span style={{ fontWeight: '600', color: 'var(--accent-cyan)' }}>{evt.title}</span>
                <span>{evt.time}</span>
              </div>
              <p style={{ color: 'var(--text-muted)', lineHeight: '1.4' }}>{evt.detail}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
