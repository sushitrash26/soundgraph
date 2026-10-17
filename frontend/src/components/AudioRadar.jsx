import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import { useStore } from '../store/useStore';
import { Activity } from 'lucide-react';

export default function AudioRadar() {
  const { selectedTrack } = useStore();

  const energy = Math.round((selectedTrack?.energy ?? 0.75) * 100);
  const valence = Math.round((selectedTrack?.valence ?? 0.65) * 100);
  const danceability = Math.round((selectedTrack?.danceability ?? 0.70) * 100);
  const acousticness = Math.round((selectedTrack?.acousticness ?? 0.15) * 100);
  const popularity = selectedTrack?.popularity ?? 80;

  const data = [
    { subject: 'Energy', value: energy, baseline: 65 },
    { subject: 'Happiness (Valence)', value: valence, baseline: 55 },
    { subject: 'Danceability', value: danceability, baseline: 70 },
    { subject: 'Acousticness', value: acousticness, baseline: 30 },
    { subject: 'Popularity', value: popularity, baseline: 75 },
  ];

  return (
    <div className="glass-panel" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#fff' }}>Audio DNA Radar</h3>
        </div>
        {selectedTrack && (
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedTrack.track_name || selectedTrack.name}
          </span>
        )}
      </div>

      <div style={{ flex: 1, minHeight: '220px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
            <PolarGrid stroke="rgba(255, 255, 255, 0.08)" />
            <PolarAngleAxis dataKey="subject" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="rgba(255, 255, 255, 0.05)" tick={false} />
            <Radar
              name="Current Track"
              dataKey="value"
              stroke="#a855f7"
              fill="#a855f7"
              fillOpacity={0.45}
            />
            <Radar
              name="Taste Baseline"
              dataKey="baseline"
              stroke="#06b6d4"
              fill="#06b6d4"
              fillOpacity={0.15}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#a855f7' }}></span>
          <span>Active Track</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#06b6d4' }}></span>
          <span>Taste Profile Average</span>
        </div>
      </div>
    </div>
  );
}
