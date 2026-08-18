'use client';

import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, CornerDownLeft } from 'lucide-react';

interface MobileToolbarProps {
  onSendKey: (data: string) => void;
}

export const MobileToolbar: React.FC<MobileToolbarProps> = ({ onSendKey }) => {
  const [bottomOffset, setBottomOffset] = useState<number>(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleVisualViewportChange = () => {
      const vv = window.visualViewport;
      if (!vv) return;

      // Calculate the difference between layout viewport and visual viewport
      const offset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      setBottomOffset(offset);
      setIsKeyboardOpen(offset > 50);
    };

    window.visualViewport.addEventListener('resize', handleVisualViewportChange);
    window.visualViewport.addEventListener('scroll', handleVisualViewportChange);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleVisualViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleVisualViewportChange);
    };
  }, []);

  const quickKeys = [
    { label: 'Tab', code: '\t', primary: true },
    { label: 'Ctrl+C', code: '\x03', danger: true },
    { label: 'Esc', code: '\x1b' },
    { label: '|', code: '|' },
    { label: '>', code: '>' },
    { label: '<', code: '<' },
    { label: '/', code: '/' },
    { label: '-', code: '-' },
    { label: '~', code: '~' },
    { label: '$', code: '$' },
  ];

  return (
    <div
      style={{
        transform: bottomOffset > 0 ? `translateY(-${bottomOffset}px)` : 'none',
        transition: 'transform 0.1s ease-out',
        paddingBottom: !isKeyboardOpen ? 'max(env(safe-area-inset-bottom, 0px), 6px)' : '6px',
      }}
      className="flex items-center justify-between px-2 pt-1.5 bg-slate-900/95 backdrop-blur border-t border-slate-800 select-none overflow-x-auto scrollbar-none z-30 gap-1.5 shrink-0"
    >
      <div className="flex items-center space-x-1">
        {quickKeys.map((k) => (
          <button
            key={k.label}
            onPointerDown={(e) => {
              e.preventDefault(); // Prevent input blurring/keyboard closing
              onSendKey(k.code);
            }}
            className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-all active:scale-95 whitespace-nowrap shadow-sm select-none ${
              k.primary
                ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 active:bg-emerald-600/50'
                : k.danger
                ? 'bg-rose-600/30 text-rose-300 border border-rose-500/40 active:bg-rose-600/50'
                : 'bg-slate-800 text-slate-300 border border-slate-700 active:bg-slate-700'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {/* Navigation Arrows & Enter */}
      <div className="flex items-center space-x-1 pl-2 border-l border-slate-800">
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            onSendKey('\x1b[A'); // Up
          }}
          className="p-1.5 rounded bg-slate-800 text-slate-300 border border-slate-700 active:bg-slate-700 select-none"
          title="Up"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            onSendKey('\x1b[B'); // Down
          }}
          className="p-1.5 rounded bg-slate-800 text-slate-300 border border-slate-700 active:bg-slate-700 select-none"
          title="Down"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            onSendKey('\x1b[D'); // Left
          }}
          className="p-1.5 rounded bg-slate-800 text-slate-300 border border-slate-700 active:bg-slate-700 select-none"
          title="Left"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            onSendKey('\x1b[C'); // Right
          }}
          className="p-1.5 rounded bg-slate-800 text-slate-300 border border-slate-700 active:bg-slate-700 select-none"
          title="Right"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            onSendKey('\r'); // Enter
          }}
          className="px-2 py-1 rounded bg-emerald-600 text-white font-mono text-xs font-bold active:bg-emerald-700 select-none"
          title="Enter"
        >
          <CornerDownLeft className="w-3.5 h-3.5 inline" />
        </button>
      </div>
    </div>
  );
};
