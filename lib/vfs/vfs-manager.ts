import { IVirtualFileSystem, VFSFileEntry, VFSStat } from './types';
import { OPFSFileSystem } from './opfs';
import { MemoryFileSystem } from './memfs';

export class VFSManager {
  private static instance: VFSManager | null = null;
  private fs: IVirtualFileSystem;
  private cwd: string = '/home/user';
  private env: Map<string, string> = new Map();
  private isOPFS: boolean = false;
  private initialized: boolean = false;

  private constructor() {
    this.fs = new MemoryFileSystem(); // fallback default until initialized
    this.initDefaultEnv();
  }

  public static getInstance(): VFSManager {
    if (!VFSManager.instance) {
      VFSManager.instance = new VFSManager();
    }
    return VFSManager.instance;
  }

  private initDefaultEnv() {
    this.env.set('HOME', '/home/user');
    this.env.set('PWD', '/home/user');
    this.env.set('USER', 'user');
    this.env.set('SHELL', '/bin/sh');
    this.env.set('PATH', '/bin:/usr/bin:/home/user/.bin');
    this.env.set('TERM', 'xterm-256color');
  }

  public async init(): Promise<{ isOPFS: boolean }> {
    if (this.initialized) return { isOPFS: this.isOPFS };

    try {
      const opfs = new OPFSFileSystem();
      await opfs.init();
      this.fs = opfs;
      this.isOPFS = true;
    } catch (e) {
      console.warn('Using MemoryFileSystem fallback:', e);
      const memfs = new MemoryFileSystem();
      await memfs.init();
      this.fs = memfs;
      this.isOPFS = false;
    }

    this.initialized = true;
    return { isOPFS: this.isOPFS };
  }

  public getIsOPFS(): boolean {
    return this.isOPFS;
  }

  public getCwd(): string {
    return this.cwd;
  }

  public setCwd(newCwd: string): void {
    this.cwd = this.resolvePath(newCwd);
    this.env.set('PWD', this.cwd);
  }

  public getEnv(key?: string): string | Map<string, string> {
    if (key) return this.env.get(key) || '';
    return this.env;
  }

  public setEnv(key: string, value: string): void {
    this.env.set(key, value);
  }

  public resolvePath(targetPath: string): string {
    let resolved = targetPath.trim();
    if (!resolved.startsWith('/')) {
      resolved = `${this.cwd}/${resolved}`;
    }

    // Replace ~/ with /home/user
    if (resolved.startsWith('~/') || resolved === '~') {
      resolved = resolved.replace('~', '/home/user');
    }

    const parts = resolved.split('/').filter((p) => p.length > 0 && p !== '.');
    const stack: string[] = [];

    for (const part of parts) {
      if (part === '..') {
        stack.pop();
      } else {
        stack.push(part);
      }
    }

    return '/' + stack.join('/');
  }

  // FS Proxy Methods
  public async readFile(path: string): Promise<Uint8Array> {
    return this.fs.readFile(this.resolvePath(path));
  }

  public async readTextFile(path: string): Promise<string> {
    return this.fs.readTextFile(this.resolvePath(path));
  }

  public async writeFile(
    path: string,
    data: Uint8Array | string,
    options?: { append?: boolean; create?: boolean }
  ): Promise<void> {
    return this.fs.writeFile(this.resolvePath(path), data, options);
  }

  public async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    return this.fs.mkdir(this.resolvePath(path), options);
  }

  public async readDir(path?: string): Promise<VFSFileEntry[]> {
    return this.fs.readDir(this.resolvePath(path || this.cwd));
  }

  public async stat(path: string): Promise<VFSStat | null> {
    return this.fs.stat(this.resolvePath(path));
  }

  public async unlink(path: string): Promise<void> {
    return this.fs.unlink(this.resolvePath(path));
  }

  public async rmdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    return this.fs.rmdir(this.resolvePath(path), options);
  }

  public async exists(path: string): Promise<boolean> {
    return this.fs.exists(this.resolvePath(path));
  }

  public async rename(oldPath: string, newPath: string): Promise<void> {
    return this.fs.rename(this.resolvePath(oldPath), this.resolvePath(newPath));
  }

  // Import file from browser (e.g. drag and drop)
  public async importFile(destinationPath: string, file: File): Promise<void> {
    const buffer = await file.arrayBuffer();
    await this.writeFile(destinationPath, new Uint8Array(buffer));
  }

  // Export file to browser download
  public async exportFile(filePath: string): Promise<void> {
    const data = await this.readFile(filePath);
    const fileName = filePath.split('/').pop() || 'download';
    const blob = new Blob([data as any]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
