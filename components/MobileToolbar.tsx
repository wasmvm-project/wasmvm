'use client';

import React from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, CornerDownLeft, XCircle } from 'lucide-react';

interface MobileToolbarProps {
  onSendKey: (data: string) => void;
}

export const MobileToolbar: React.FC<MobileToolbarProps> = ({ onSendKey }) => {
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
    <div className="flex items-center justify-between px-2 py-1.5 bg-slate-900/90 backdrop-blur border-t border-slate-800 select-none overflow-x-auto scrollbar-none z-10 gap-1.5">
      <div className="flex items-center space-x-1">
        {quickKeys.map((k) => (
          <button
            key={k.label}
            onClick={(e) => {
              e.preventDefault();
              onSendKey(k.code);
            }}
            className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-all active:scale-95 whitespace-nowrap shadow-sm ${
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

      {/* Navigation Arrows */}
      <div className="flex items-center space-x-1 pl-2 border-l border-slate-800">
        <button
          onClick={(e) => {
            e.preventDefault();
            onSendKey('\x1b[A'); // Up
          }}
          className="p-1.5 rounded bg-slate-800 text-slate-300 border border-slate-700 active:bg-slate-700"
          title="Up"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            onSendKey('\x1b[B'); // Down
          }}
          className="p-1.5 rounded bg-slate-800 text-slate-300 border border-slate-700 active:bg-slate-700"
          title="Down"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            onSendKey('\x1b[D'); // Left
          }}
          className="p-1.5 rounded bg-slate-800 text-slate-300 border border-slate-700 active:bg-slate-700"
          title="Left"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            onSendKey('\x1b[C'); // Right
          }}
          className="p-1.5 rounded bg-slate-800 text-slate-300 border border-slate-700 active:bg-slate-700"
          title="Right"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            onSendKey('\r'); // Enter
          }}
          className="px-2 py-1 rounded bg-emerald-600 text-white font-mono text-xs font-bold active:bg-emerald-700"
          title="Enter"
        >
          <CornerDownLeft className="w-3.5 h-3.5 inline" />
        </button>
      </div>
    </div>
  );
};
