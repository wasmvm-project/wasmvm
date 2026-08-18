'use client';

import React, { useState, useEffect } from 'react';
import { Terminal, HardDrive, Cpu, Package, Folder, Maximize2, Minimize2, Sparkles, Download } from 'lucide-react';

interface HeaderProps {
  isOPFS: boolean;
  onOpenWpm: () => void;
  onToggleExplorer: () => void;
  onOpenEditor: () => void;
  onMountLocal: () => void;
  explorerOpen: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isOPFS,
  onOpenWpm,
  onToggleExplorer,
  onOpenEditor,
  onMountLocal,
  explorerOpen,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already in standalone PWA mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const choiceResult = await installPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setInstallPrompt(null);
      }
    } else {
      // Fallback guide for iOS / Safari
      alert('To install on iPhone/iPad:\nTap the Share button (⎋) in Safari and choose "Add to Home Screen" (+)!');
    }
  };

  return (
    <header className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-slate-200 z-10 select-none">
      {/* Brand */}
      <div className="flex items-center space-x-3">
        <div className="p-1.5 rounded-lg bg-gradient-to-tr from-emerald-500 to-cyan-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
          <Terminal className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-mono font-bold text-lg tracking-tight text-white">wasm<span className="text-emerald-400">vm</span></span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-medium">
              v1.0.0
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            0ms Browser POSIX • OPFS Native • WASI Runtime
          </p>
        </div>
      </div>

      {/* Badges & Status */}
      <div className="flex items-center space-x-2 my-1 sm:my-0">
        {/* Storage status */}
        <div
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-mono border ${
            isOPFS
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
          }`}
          title={isOPFS ? 'Using fast Origin Private File System (OPFS)' : 'Using In-Memory Virtual File System'}
        >
          <HardDrive className="w-3.5 h-3.5" />
          <span className="text-[11px] font-semibold">{isOPFS ? 'OPFS Native' : 'MemFS'}</span>
        </div>

        {/* JIT / WASI status */}
        <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-mono border bg-cyan-950/60 border-cyan-500/40 text-cyan-300">
          <Cpu className="w-3.5 h-3.5" />
          <span className="text-[11px] font-semibold">WebKit JIT / WASI</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-2">
        {/* Install PWA Button */}
        {!isInstalled && (
          <button
            onClick={handleInstallClick}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600/30 to-cyan-600/30 hover:from-emerald-600/50 hover:to-cyan-600/50 border border-cyan-500/40 text-xs font-medium text-cyan-300 hover:text-white transition-all shadow-sm"
            title="Install wasmvm as standalone native App"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Install App</span>
          </button>
        )}

        <button
          onClick={onMountLocal}
          className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-amber-300 hover:text-amber-200 transition-all shadow-sm"
          title="Mount Host Local Folder (Chrome/Edge)"
        >
          <HardDrive className="w-4 h-4 text-amber-400" />
          <span>Mount PC</span>
        </button>

        <button
          onClick={onOpenEditor}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium transition-all text-slate-200 hover:text-white shadow-sm"
          title="Open Monaco Code Editor"
        >
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="hidden sm:inline">IDE</span>
        </button>

        <button
          onClick={onOpenWpm}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 text-xs font-medium transition-all text-slate-200 hover:text-white shadow-sm"
          title="WASM Package Manager"
        >
          <Package className="w-4 h-4 text-emerald-400" />
          <span className="hidden sm:inline font-mono">wpm</span>
        </button>

        <button
          onClick={onToggleExplorer}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
            explorerOpen
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
          }`}
          title="File Explorer"
        >
          <Folder className="w-4 h-4 text-cyan-400" />
          <span className="hidden sm:inline">Files</span>
        </button>

        <button
          onClick={onToggleFullscreen}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all"
          title="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
