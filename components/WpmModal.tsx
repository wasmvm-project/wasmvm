'use client';

import React, { useState, useEffect } from 'react';
import { VFSManager } from '../lib/vfs/vfs-manager';
import { WpmManager } from '../lib/wpm/manager';
import { WpmPackage } from '../lib/wpm/registry';
import { Package, Download, Trash2, CheckCircle2, Search, X, Sparkles, Terminal } from 'lucide-react';

interface WpmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunPackageInTerm: (cmd: string) => void;
}

export const WpmModal: React.FC<WpmModalProps> = ({
  isOpen,
  onClose,
  onRunPackageInTerm,
}) => {
  const [packages, setPackages] = useState<WpmPackage[]>([]);
  const [search, setSearch] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const vfs = VFSManager.getInstance();
  const manager = new WpmManager(vfs);

  const loadPackages = async () => {
    const pkgs = await manager.listPackages();
    setPackages(pkgs);
  };

  useEffect(() => {
    if (isOpen) {
      loadPackages();
    }
  }, [isOpen]);

  const handleInstall = async (pkg: WpmPackage) => {
    setInstalling(pkg.name);
    try {
      await manager.install(pkg.name);
      await loadPackages();
    } catch (e: any) {
      alert(`Install failed: ${e.message}`);
    } finally {
      setInstalling(null);
    }
  };

  const handleUninstall = async (pkg: WpmPackage) => {
    try {
      await manager.remove(pkg.name);
      await loadPackages();
    } catch (e: any) {
      alert(`Uninstall failed: ${e.message}`);
    }
  };

  const filtered = packages.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
                wpm <span className="text-slate-400 text-xs font-normal font-sans">WASM Package Manager</span>
              </h2>
              <p className="text-xs text-slate-400">Install standalone .wasm tools instantly into /bin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search packages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="flex items-center space-x-1.5 self-start sm:self-auto overflow-x-auto w-full sm:w-auto">
            {['all', 'utilities', 'programming', 'games'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-xs capitalize transition-colors font-medium ${
                  selectedCategory === cat
                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Package Grid */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-sm">
              No packages matching your criteria.
            </div>
          )}

          {filtered.map((pkg) => (
            <div
              key={pkg.name}
              className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between gap-4 hover:border-slate-700 transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2.5 mb-1">
                  <span className="font-mono font-bold text-sm text-emerald-400">{pkg.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                    v{pkg.version}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-400 font-mono">
                    {pkg.size}
                  </span>
                </div>
                <p className="text-xs text-slate-300 line-clamp-1">{pkg.description}</p>
                {pkg.author && (
                  <p className="text-[11px] text-slate-500 mt-0.5">Author: {pkg.author}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2 shrink-0">
                {pkg.installed ? (
                  <>
                    <button
                      onClick={() => {
                        onRunPackageInTerm(pkg.name);
                        onClose();
                      }}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 text-xs font-semibold font-mono transition-all"
                      title="Run command in terminal"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      <span>Run</span>
                    </button>
                    <button
                      onClick={() => handleUninstall(pkg)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                      title="Uninstall"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleInstall(pkg)}
                    disabled={installing === pkg.name}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{installing === pkg.name ? 'Installing...' : 'Install'}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40 text-center text-xs text-slate-400">
          Installed WASM packages are stored locally in OPFS at <code className="text-emerald-400">/bin/</code> and cached in Cache API.
        </div>
      </div>
    </div>
  );
};
