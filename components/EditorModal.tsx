'use client';

import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { VFSManager } from '../lib/vfs/vfs-manager';
import { Save, X, FileCode, Check, Copy } from 'lucide-react';

interface EditorModalProps {
  filePath: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (path: string) => void;
}

export const EditorModal: React.FC<EditorModalProps> = ({
  filePath,
  isOpen,
  onClose,
  onSaved,
}) => {
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const vfs = VFSManager.getInstance();

  const getLanguageFromPath = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'mjs':
        return 'javascript';
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'py':
        return 'python';
      case 'c':
      case 'h':
        return 'c';
      case 'cpp':
      case 'cc':
        return 'cpp';
      case 'rs':
        return 'rust';
      case 'sh':
      case 'bash':
      case 'bashrc':
        return 'shell';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      case 'sql':
        return 'sql';
      default:
        return 'plaintext';
    }
  };

  useEffect(() => {
    if (isOpen && filePath) {
      setLanguage(getLanguageFromPath(filePath));
      vfs
        .readTextFile(filePath)
        .then((text) => setContent(text))
        .catch(() => setContent(''));
    }
  }, [isOpen, filePath]);

  const handleSave = async () => {
    if (!filePath) return;
    setIsSaving(true);
    try {
      await vfs.writeFile(filePath, content);
      setSavedSuccess(true);
      onSaved?.(filePath);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (e: any) {
      alert(`Failed to save: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcut Ctrl+S or Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, content, filePath]);

  if (!isOpen || !filePath) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-[#1e1e1e] border border-slate-700 rounded-2xl w-full h-full max-w-5xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Editor Title Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#252526] border-b border-slate-700 select-none">
          <div className="flex items-center space-x-2.5 truncate">
            <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-mono text-sm font-semibold text-slate-200 truncate">
              {filePath}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono uppercase">
              {language}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all shadow-sm ${
                savedSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950'
              }`}
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save (Ctrl+S)'}</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Close Editor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Monaco Editor Container */}
        <div className="flex-1 w-full h-full overflow-hidden">
          <Editor
            height="100%"
            language={language}
            theme="vs-dark"
            value={content}
            onChange={(val) => setContent(val || '')}
            options={{
              fontSize: 14,
              fontFamily: 'Menlo, Monaco, "Cascadia Code", "Fira Code", monospace',
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: 'on',
              tabSize: 2,
            }}
          />
        </div>

        {/* Editor Status Bar */}
        <div className="px-4 py-1 bg-[#007acc] text-white text-xs font-mono flex items-center justify-between select-none">
          <div className="flex items-center space-x-3">
            <span>wasmvm Monaco IDE</span>
            <span>UTF-8</span>
            <span>{language.toUpperCase()}</span>
          </div>
          <div>Press Ctrl+S to save directly to OPFS</div>
        </div>
      </div>
    </div>
  );
};
