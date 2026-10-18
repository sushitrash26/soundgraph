import React, { useState, useRef, useEffect } from 'react';
import { 
  Music2, 
  Tv, 
  LayoutDashboard, 
  Compass, 
  LogOut, 
  ChevronDown, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useStore } from '../store/useStore';

export default function NavbarProfileDropdown({ activeTab, setActiveTab }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { user, authStatus, logout } = useStore();

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Trigger Avatar Chip */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 10px 4px 4px',
          borderRadius: '999px',
          background: isOpen ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.04)',
          border: isOpen ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
      >
        {user?.avatar_url ? (
          <img 
            src={user.avatar_url} 
            alt={user.name || 'User'} 
            style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} 
          />
        ) : (
          <div style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #a855f7, #06b6d4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: '700',
            color: '#fff'
          }}>
            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
          </div>
        )}

        <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#fff' }}>
          {user?.name || 'Astitva'}
        </span>

        <ChevronDown size={14} color="#9B9B9B" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: '260px',
          background: '#121217',
          border: '1px solid #27272F',
          borderRadius: '18px',
          padding: '8px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 30px rgba(168, 85, 247, 0.1)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          {/* Header Summary */}
          <div style={{
            padding: '10px 12px 12px',
            borderBottom: '1px solid #1E1E26',
            marginBottom: '4px'
          }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#FFFFFF' }}>
              {user?.name || 'Astitva'}
            </div>
            <div style={{ fontSize: '11px', color: '#9B9B9B', marginTop: '2px' }}>
              Unified Taste Identity
            </div>
            {/* Platform connection status pills */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <span style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '4px',
                background: authStatus?.spotify_connected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                color: authStatus?.spotify_connected ? '#4ade80' : '#666',
                border: authStatus?.spotify_connected ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid #272727',
                fontWeight: '600'
              }}>
                Spotify {authStatus?.spotify_connected ? '●' : '○'}
              </span>

              <span style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '4px',
                background: authStatus?.google_connected ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                color: authStatus?.google_connected ? '#f87171' : '#666',
                border: authStatus?.google_connected ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #272727',
                fontWeight: '600'
              }}>
                YouTube {authStatus?.google_connected ? '●' : '○'}
              </span>
            </div>
          </div>

          {/* Navigation Option 1: Spotify Hub */}
          <button
            onClick={() => handleSelectTab('spotify')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 12px',
              borderRadius: '10px',
              background: activeTab === 'spotify' ? 'rgba(34, 197, 94, 0.12)' : 'transparent',
              border: 'none',
              color: activeTab === 'spotify' ? '#4ade80' : '#CCCCCC',
              fontSize: '12.5px',
              fontWeight: '600',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'}
            onMouseLeave={(e) => e.currentTarget.style.background = activeTab === 'spotify' ? 'rgba(34, 197, 94, 0.12)' : 'transparent'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Music2 size={15} color="#22c55e" />
              <span>Spotify Hub & Playlists</span>
            </div>
            <ArrowRight size={12} color="#666" />
          </button>

          {/* Navigation Option 2: YouTube Hub */}
          <button
            onClick={() => handleSelectTab('youtube')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 12px',
              borderRadius: '10px',
              background: activeTab === 'youtube' ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
              border: 'none',
              color: activeTab === 'youtube' ? '#f87171' : '#CCCCCC',
              fontSize: '12.5px',
              fontWeight: '600',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'}
            onMouseLeave={(e) => e.currentTarget.style.background = activeTab === 'youtube' ? 'rgba(239, 68, 68, 0.12)' : 'transparent'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Tv size={15} color="#ef4444" />
              <span>YouTube Music Hub & Playlists</span>
            </div>
            <ArrowRight size={12} color="#666" />
          </button>

          {/* Navigation Option 3: Discovery Dashboard */}
          <button
            onClick={() => handleSelectTab('dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 12px',
              borderRadius: '10px',
              background: activeTab === 'dashboard' ? 'rgba(168, 85, 247, 0.12)' : 'transparent',
              border: 'none',
              color: activeTab === 'dashboard' ? '#c084fc' : '#CCCCCC',
              fontSize: '12.5px',
              fontWeight: '600',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'}
            onMouseLeave={(e) => e.currentTarget.style.background = activeTab === 'dashboard' ? 'rgba(168, 85, 247, 0.12)' : 'transparent'}
          >
            <LayoutDashboard size={15} color="#a855f7" />
            <span>Discovery Dashboard</span>
          </button>

          {/* Navigation Option 4: Cross-Platform Graph */}
          <button
            onClick={() => handleSelectTab('explorer')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 12px',
              borderRadius: '10px',
              background: activeTab === 'explorer' ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
              border: 'none',
              color: activeTab === 'explorer' ? '#38bdf8' : '#CCCCCC',
              fontSize: '12.5px',
              fontWeight: '600',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'}
            onMouseLeave={(e) => e.currentTarget.style.background = activeTab === 'explorer' ? 'rgba(6, 182, 212, 0.12)' : 'transparent'}
          >
            <Compass size={15} color="#06b6d4" />
            <span>Graph Topology Explorer</span>
          </button>

          {/* Divider */}
          <div style={{ height: '1px', background: '#1E1E26', margin: '4px 0' }} />

          {/* Logout */}
          <button
            onClick={() => {
              setIsOpen(false);
              logout();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 12px',
              borderRadius: '10px',
              background: 'transparent',
              border: 'none',
              color: '#ef4444',
              fontSize: '12.5px',
              fontWeight: '600',
              cursor: 'pointer',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <LogOut size={15} />
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
}
