'use client';

import React, { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Header } from '../components/Header';
import { MobileToolbar } from '../components/MobileToolbar';
import { FileExplorer } from '../components/FileExplorer';
import { WpmModal } from '../components/WpmModal';
import { EditorModal } from '../components/EditorModal';
import { TerminalHandle } from '../components/Terminal';

// Dynamic import for Terminal (browser-only)
const TerminalComponent = dynamic(
  () => import('../components/Terminal').then((mod) => mod.TerminalComponent),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-[#0a0f1d] text-slate-400 font-mono text-sm">
        <div className="flex items-center space-x-3">
          <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <span>Booting wasmvm POSIX runtime...</span>
        </div>
      </div>
    ),
  }
);

export default function Home() {
  const [isOPFS, setIsOPFS] = useState(true);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [wpmOpen, setWpmOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeFilePath, setActiveFilePath] = useState<string | null>('/home/user/welcome.txt');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const terminalRef = useRef<TerminalHandle | null>(null);

  // Listen for terminal "code <file>" event
  useEffect(() => {
    const handleOpenEditorEvent = (e: any) => {
      if (e.detail && e.detail.path) {
        setActiveFilePath(e.detail.path);
        setEditorOpen(true);
      }
    };
    window.addEventListener('wasmvm:open-editor', handleOpenEditorEvent);
    return () => window.removeEventListener('wasmvm:open-editor', handleOpenEditorEvent);
  }, []);

  // Lock window scrolling on mobile devices (Termux-like fixed layout)
  useEffect(() => {
    const lockScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };

    window.addEventListener('scroll', lockScroll, { passive: false });
    window.visualViewport?.addEventListener('scroll', lockScroll);
    window.visualViewport?.addEventListener('resize', lockScroll);

    return () => {
      window.removeEventListener('scroll', lockScroll);
      window.visualViewport?.removeEventListener('scroll', lockScroll);
      window.visualViewport?.removeEventListener('resize', lockScroll);
    };
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const handleSendKey = (key: string) => {
    terminalRef.current?.sendKey(key);
  };

  const handleRunPackage = (pkgName: string) => {
    terminalRef.current?.runCommand(pkgName);
  };

  const handleOpenEditorDirectly = (path?: string) => {
    setActiveFilePath(path || '/home/user/welcome.txt');
    setEditorOpen(true);
  };

  const handleMountLocal = () => {
    terminalRef.current?.runCommand('mount-local');
  };

  return (
    <main className="flex flex-col h-[100dvh] w-screen overflow-hidden bg-[#0a0f1d]">
      {/* Top Header Navigation */}
      <Header
        isOPFS={isOPFS}
        onOpenWpm={() => setWpmOpen(true)}
        onToggleExplorer={() => setExplorerOpen(!explorerOpen)}
        onOpenEditor={() => handleOpenEditorDirectly()}
        onMountLocal={handleMountLocal}
        explorerOpen={explorerOpen}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
      />

      {/* Main Terminal & File Explorer Area */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 h-full flex flex-col min-w-0">
          <TerminalComponent
            ref={terminalRef}
            onInitFinished={(opfs) => setIsOPFS(opfs)}
          />
        </div>

        {/* Sidebar File Explorer */}
        {explorerOpen && (
          <FileExplorer
            isOpen={explorerOpen}
            onClose={() => setExplorerOpen(false)}
            onOpenFileInEditor={(path) => handleOpenEditorDirectly(path)}
          />
        )}
      </div>

      {/* Mobile-friendly on-screen toolbar */}
      <MobileToolbar onSendKey={handleSendKey} />

      {/* WPM Modal */}
      <WpmModal
        isOpen={wpmOpen}
        onClose={() => setWpmOpen(false)}
        onRunPackageInTerm={handleRunPackage}
      />

      {/* Monaco Code Editor Modal */}
      <EditorModal
        isOpen={editorOpen}
        filePath={activeFilePath}
        onClose={() => setEditorOpen(false)}
        onSaved={(path) => {
          terminalRef.current?.runCommand(`echo "File '${path}' saved successfully."`);
        }}
      />
    </main>
  );
}
