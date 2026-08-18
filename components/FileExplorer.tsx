'use client';

import React, { useState, useEffect } from 'react';
import { VFSManager } from '../lib/vfs/vfs-manager';
import { VFSFileEntry } from '../lib/vfs/types';
import {
  Folder,
  File,
  FileText,
  FileCode,
  Download,
  Trash2,
  Upload,
  RefreshCw,
  FolderPlus,
  FilePlus,
  ChevronRight,
  ChevronDown,
  X,
} from 'lucide-react';

interface FileExplorerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFileInEditor?: (path: string) => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  isOpen,
  onClose,
  onOpenFileInEditor,
}) => {
  const [currentPath, setCurrentPath] = useState('/home/user');
  const [entries, setEntries] = useState<VFSFileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const vfs = VFSManager.getInstance();

  const loadEntries = async (path: string) => {
    setLoading(true);
    try {
      const items = await vfs.readDir(path);
      setEntries(items);
      setCurrentPath(path);
      setSelectedFile(null);
      setPreviewContent(null);
    } catch (e) {
      console.error('Failed to read dir:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadEntries(currentPath);
    }
  }, [isOpen]);

  const handleEntryClick = async (entry: VFSFileEntry) => {
    const fullPath = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`;
    if (entry.type === 'dir') {
      loadEntries(fullPath);
    } else {
      setSelectedFile(fullPath);
      try {
        const text = await vfs.readTextFile(fullPath);
        setPreviewContent(text);
      } catch {
        setPreviewContent('[Binary or unreadable file]');
      }
    }
  };

  const handleGoUp = () => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const upPath = '/' + parts.join('/');
    loadEntries(upPath);
  };

  const handleDownload = async (path: string) => {
    await vfs.exportFile(path);
  };

  const handleDelete = async (entry: VFSFileEntry) => {
    const fullPath = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`;
    if (confirm(`Delete '${entry.name}'?`)) {
      if (entry.type === 'dir') {
        await vfs.rmdir(fullPath, { recursive: true });
      } else {
        await vfs.unlink(fullPath);
      }
      loadEntries(currentPath);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const destPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
    await vfs.importFile(destPath, file);
    loadEntries(currentPath);
  };

  const handleCreateNewFile = async () => {
    const name = prompt('Enter new file name:');
    if (!name) return;
    const path = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    await vfs.writeFile(path, '');
    loadEntries(currentPath);
  };

  const handleCreateNewFolder = async () => {
    const name = prompt('Enter new folder name:');
    if (!name) return;
    const path = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    await vfs.mkdir(path);
    loadEntries(currentPath);
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 h-full bg-slate-900 border-l border-slate-800 flex flex-col z-20 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-center space-x-2">
          <Folder className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-sm text-slate-200">OPFS Storage</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => loadEntries(currentPath)}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Path Bar & Actions */}
      <div className="p-2 border-b border-slate-800 flex items-center justify-between gap-1 text-xs">
        <div className="font-mono text-slate-300 truncate bg-slate-950 px-2 py-1 rounded flex-1 border border-slate-800">
          {currentPath}
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={handleCreateNewFile}
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
            title="New File"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleCreateNewFolder}
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
            title="New Folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <label
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
            title="Upload File to VFS"
          >
            <Upload className="w-3.5 h-3.5" />
            <input type="file" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5 text-xs font-mono">
        {currentPath !== '/' && (
          <div
            onClick={handleGoUp}
            className="flex items-center space-x-2 p-1.5 rounded hover:bg-slate-800 cursor-pointer text-slate-400 hover:text-white"
          >
            <Folder className="w-4 h-4 text-amber-400" />
            <span>.. (parent directory)</span>
          </div>
        )}

        {entries.length === 0 && !loading && (
          <div className="p-4 text-center text-slate-500 italic">Empty directory</div>
        )}

        {entries.map((entry) => {
          const isDir = entry.type === 'dir';
          return (
            <div
              key={entry.name}
              className="flex items-center justify-between p-1.5 rounded hover:bg-slate-800/80 group cursor-pointer"
              onClick={() => handleEntryClick(entry)}
            >
              <div className="flex items-center space-x-2 truncate flex-1">
                {isDir ? (
                  <Folder className="w-4 h-4 text-sky-400 shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <span className={`truncate ${isDir ? 'font-semibold text-slate-200' : 'text-slate-300'}`}>
                  {entry.name}
                </span>
              </div>

              {/* Actions on hover */}
              <div className="hidden group-hover:flex items-center space-x-1 shrink-0">
                {!isDir && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const full = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`;
                        onOpenFileInEditor?.(full);
                      }}
                      className="p-1 text-slate-400 hover:text-cyan-400 rounded"
                      title="Edit in Monaco IDE"
                    >
                      <FileCode className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`);
                      }}
                      className="p-1 text-slate-400 hover:text-emerald-400 rounded"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(entry);
                  }}
                  className="p-1 text-slate-400 hover:text-rose-400 rounded"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* File Preview Drawer */}
      {selectedFile && previewContent !== null && (
        <div className="h-48 border-t border-slate-800 bg-slate-950 p-2 flex flex-col">
          <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-800 text-[11px] text-slate-400 font-mono">
            <span className="truncate">{selectedFile}</span>
            <button onClick={() => setSelectedFile(null)} className="hover:text-white">
              <X className="w-3 h-3" />
            </button>
          </div>
          <pre className="flex-1 overflow-auto text-[11px] font-mono text-slate-300 whitespace-pre-wrap select-text">
            {previewContent}
          </pre>
        </div>
      )}
    </div>
  );
};
