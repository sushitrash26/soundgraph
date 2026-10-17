import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { X, Send, Sparkles, MessageSquare, Loader2 } from 'lucide-react';

const SUGGESTIONS = [
  'Late night synthwave for coding',
  'Melancholic rainy acoustic tracks',
  'High energy workout gym motivation',
  'Cross-platform bridge between Hindi & Western pop'
];

export default function MoodChatModal() {
  const { isChatOpen, toggleChat, chatMessages, isChatLoading, sendChatPrompt } = useStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isChatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatOpen]);

  if (!isChatOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isChatLoading) return;
    const q = input;
    setInput('');
    await sendChatPrompt(q);
  };

  const handleSuggestion = async (s) => {
    await sendChatPrompt(s);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(12px)',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '560px',
        height: '620px',
        maxHeight: '90vh',
        background: '#121217',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 32px 64px -16px rgba(0, 0, 0, 0.9), 0 0 40px rgba(168, 85, 247, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sparkles size={16} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#fff', margin: 0 }}>
                SoundGraph Vibe Assistant
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                Powered by Neo4j GraphRAG & Ingested Telemetry
              </p>
            </div>
          </div>

          <button
            onClick={toggleChat}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              cursor: 'pointer',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'}
          >
            <X size={16} />
          </button>
        </div>

        {/* Conversation Stream */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {chatMessages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: isUser ? 'flex-end' : 'flex-start'
                }}
              >
                <div style={{
                  maxWidth: '82%',
                  padding: '12px 18px',
                  borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: isUser 
                    ? 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)' 
                    : 'rgba(255, 255, 255, 0.05)',
                  border: isUser ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                  color: isUser ? '#fff' : '#e2e8f0',
                  fontSize: '13.5px',
                  lineHeight: '1.55',
                  boxShadow: isUser ? '0 4px 16px rgba(168, 85, 247, 0.25)' : 'none'
                }}>
                  {msg.text}
                </div>
              </div>
            );
          })}

          {isChatLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c084fc', fontSize: '12.5px', padding: '4px' }}>
              <Loader2 size={16} className="spin" />
              <span>Analyzing graph topology & cross-platform affinities...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Pills */}
        <div style={{
          padding: '8px 20px',
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          borderTop: '1px solid rgba(255, 255, 255, 0.04)'
        }}>
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSuggestion(s)}
              style={{
                fontSize: '11.5px',
                padding: '5px 12px',
                borderRadius: '999px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#94a3b8',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = '#94a3b8';
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSubmit} style={{
          padding: '16px 20px 20px',
          display: 'flex',
          gap: '10px'
        }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask for any vibe, setting, or sound..."
            style={{
              flex: 1,
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              padding: '12px 18px',
              color: '#fff',
              fontSize: '14px',
              outline: 'none',
              transition: 'border-color 0.2s ease'
            }}
            onFocus={(e) => e.target.style.borderColor = 'rgba(168, 85, 247, 0.5)'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)'}
          />
          <button
            type="submit"
            disabled={!input.trim() || isChatLoading}
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              cursor: input.trim() && !isChatLoading ? 'pointer' : 'not-allowed',
              opacity: input.trim() && !isChatLoading ? 1 : 0.4,
              transition: 'opacity 0.2s ease'
            }}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
