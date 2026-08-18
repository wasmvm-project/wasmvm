import { IVirtualFileSystem, VFSFileEntry, VFSStat } from './types';

export class OPFSFileSystem implements IVirtualFileSystem {
  private rootHandle: FileSystemDirectoryHandle | null = null;
  private isInitialized = false;

  public async init(): Promise<void> {
    if (this.isInitialized && this.rootHandle) return;

    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.getDirectory) {
      try {
        this.rootHandle = await navigator.storage.getDirectory();
        this.isInitialized = true;
        await this.bootstrapDefaultDirs();
        return;
      } catch (e) {
        console.warn('OPFS initialization failed, falling back to memory/mock:', e);
      }
    }
    throw new Error('OPFS is not supported in this environment');
  }

  private async bootstrapDefaultDirs(): Promise<void> {
    const defaultDirs = ['/home/user', '/bin', '/tmp', '/etc', '/var'];
    for (const dir of defaultDirs) {
      await this.mkdir(dir, { recursive: true });
    }

    // デフォルトファイルの作成 (もし存在しなければ)
    if (!(await this.exists('/home/user/welcome.txt'))) {
      const welcome = `=====================================================
  Welcome to wasmvm (WebAssembly POSIX OS)
=====================================================

Features:
- 0ms instant startup with JS built-in commands
- Native OPFS (Origin Private File System) persistence
- WebAssembly & WASI Preview 1 worker engine
- WASM Package Manager (wpm) support
- Full mobile / iPhone Safari & desktop support

Type 'help' to see available commands.
Type 'wpm list' to explore installable WASM packages.
`;
      await this.writeFile('/home/user/welcome.txt', welcome);
    }

    if (!(await this.exists('/home/user/.bashrc'))) {
      const bashrc = `# wasmvm .bashrc
alias ll='ls -la'
alias la='ls -A'
alias l='ls -lh'
alias gs='git status'
alias gp='git push'
alias gl='git log'

export EDITOR=code
export PAGER=cat
`;
      await this.writeFile('/home/user/.bashrc', bashrc);
    }
  }

  private normalizePath(path: string): string[] {
    const parts = path.split('/').filter((p) => p.length > 0 && p !== '.');
    const result: string[] = [];
    for (const part of parts) {
      if (part === '..') {
        result.pop();
      } else {
        result.push(part);
      }
    }
    return result;
  }

  private async getDirectoryHandle(
    parts: string[],
    create = false
  ): Promise<FileSystemDirectoryHandle> {
    if (!this.rootHandle) throw new Error('OPFS not initialized');
    let current = this.rootHandle;
    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create });
    }
    return current;
  }

  public async readFile(path: string): Promise<Uint8Array> {
    const parts = this.normalizePath(path);
    if (parts.length === 0) {
      throw new Error(`EISDIR: illegal operation on a directory, read '${path}'`);
    }
    const fileName = parts.pop()!;
    const dirHandle = await this.getDirectoryHandle(parts, false);
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: false });
    const file = await fileHandle.getFile();
    const buffer = await file.arrayBuffer();
    return new Uint8Array(buffer);
  }

  public async readTextFile(path: string): Promise<string> {
    const data = await this.readFile(path);
    return new TextDecoder().decode(data);
  }

  public async writeFile(
    path: string,
    data: Uint8Array | string,
    options?: { append?: boolean; create?: boolean }
  ): Promise<void> {
    const parts = this.normalizePath(path);
    if (parts.length === 0) {
      throw new Error(`EISDIR: cannot write to root directory`);
    }
    const fileName = parts.pop()!;
    const dirHandle = await this.getDirectoryHandle(parts, true);
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });

    const writable = await fileHandle.createWritable({
      keepExistingData: !!options?.append,
    });

    if (options?.append) {
      const file = await fileHandle.getFile();
      await writable.seek(file.size);
    }

    const payload = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    await writable.write(payload as any);
    await writable.close();
  }

  public async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const parts = this.normalizePath(path);
    if (parts.length === 0) return;

    if (options?.recursive) {
      let current = this.rootHandle!;
      for (const part of parts) {
        current = await current.getDirectoryHandle(part, { create: true });
      }
    } else {
      const parentParts = [...parts];
      const dirName = parentParts.pop()!;
      const parent = await this.getDirectoryHandle(parentParts, false);
      await parent.getDirectoryHandle(dirName, { create: true });
    }
  }

  public async readDir(path: string): Promise<VFSFileEntry[]> {
    const parts = this.normalizePath(path);
    const dirHandle = await this.getDirectoryHandle(parts, false);
    const entries: VFSFileEntry[] = [];

    // @ts-ignore entries iterator
    for await (const [name, handle] of (dirHandle as any).entries()) {
      if (handle.kind === 'directory') {
        entries.push({
          name,
          type: 'dir',
          size: 4096,
          mtime: Date.now(),
        });
      } else {
        const file = await (handle as FileSystemFileHandle).getFile();
        entries.push({
          name,
          type: 'file',
          size: file.size,
          mtime: file.lastModified,
        });
      }
    }

    return entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  public async stat(path: string): Promise<VFSStat | null> {
    const parts = this.normalizePath(path);
    if (parts.length === 0) {
      return {
        name: '/',
        type: 'dir',
        size: 4096,
        mtime: Date.now(),
      };
    }

    const targetName = parts[parts.length - 1];
    const parentParts = parts.slice(0, parts.length - 1);

    try {
      const parentHandle = await this.getDirectoryHandle(parentParts, false);
      try {
        const fileHandle = await parentHandle.getFileHandle(targetName, { create: false });
        const file = await fileHandle.getFile();
        return {
          name: targetName,
          type: 'file',
          size: file.size,
          mtime: file.lastModified,
        };
      } catch {
        // Not a file, check if directory
        const dirHandle = await parentHandle.getDirectoryHandle(targetName, { create: false });
        if (dirHandle) {
          return {
            name: targetName,
            type: 'dir',
            size: 4096,
            mtime: Date.now(),
          };
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  public async unlink(path: string): Promise<void> {
    const parts = this.normalizePath(path);
    if (parts.length === 0) throw new Error('Cannot unlink root');
    const name = parts.pop()!;
    const parent = await this.getDirectoryHandle(parts, false);
    await parent.removeEntry(name, { recursive: false });
  }

  public async rmdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const parts = this.normalizePath(path);
    if (parts.length === 0) throw new Error('Cannot remove root directory');
    const name = parts.pop()!;
    const parent = await this.getDirectoryHandle(parts, false);
    await parent.removeEntry(name, { recursive: !!options?.recursive });
  }

  public async exists(path: string): Promise<boolean> {
    const s = await this.stat(path);
    return s !== null;
  }

  public async rename(oldPath: string, newPath: string): Promise<void> {
    const data = await this.readFile(oldPath);
    await this.writeFile(newPath, data);
    await this.unlink(oldPath);
  }
}
