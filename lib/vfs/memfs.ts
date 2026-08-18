import { IVirtualFileSystem, VFSFileEntry, VFSStat } from './types';

interface MemNode {
  name: string;
  type: 'file' | 'dir';
  content?: Uint8Array;
  children?: Map<string, MemNode>;
  mtime: number;
}

export class MemoryFileSystem implements IVirtualFileSystem {
  private root: MemNode = {
    name: '',
    type: 'dir',
    children: new Map(),
    mtime: Date.now(),
  };

  public async init(): Promise<void> {
    const defaultDirs = ['/home/user', '/bin', '/tmp', '/etc', '/var'];
    for (const dir of defaultDirs) {
      await this.mkdir(dir, { recursive: true });
    }

    if (!(await this.exists('/home/user/welcome.txt'))) {
      const welcome = `=====================================================
  Welcome to wasmvm (WebAssembly POSIX OS) [MemFS Mode]
=====================================================

Features:
- 0ms instant startup with JS built-in commands
- WebAssembly & WASI Preview 1 worker engine
- WASM Package Manager (wpm) support

Type 'help' to see available commands.
`;
      await this.writeFile('/home/user/welcome.txt', welcome);
    }

    if (!(await this.exists('/home/user/.bashrc'))) {
      const bashrc = `# wasmvm .bashrc
alias ll='ls -la'
alias la='ls -A'
alias l='ls -lh'
alias gs='git status'
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

  private getNode(parts: string[]): MemNode | null {
    let current = this.root;
    for (const part of parts) {
      if (current.type !== 'dir' || !current.children) return null;
      const next = current.children.get(part);
      if (!next) return null;
      current = next;
    }
    return current;
  }

  public async readFile(path: string): Promise<Uint8Array> {
    const parts = this.normalizePath(path);
    const node = this.getNode(parts);
    if (!node) throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    if (node.type === 'dir') throw new Error(`EISDIR: illegal operation on a directory, read '${path}'`);
    return node.content || new Uint8Array();
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
    if (parts.length === 0) throw new Error(`EISDIR: cannot write to root`);
    const fileName = parts.pop()!;
    let parent = this.getNode(parts);

    if (!parent) {
      await this.mkdir('/' + parts.join('/'), { recursive: true });
      parent = this.getNode(parts);
    }

    if (!parent || parent.type !== 'dir' || !parent.children) {
      throw new Error(`ENOTDIR: not a directory`);
    }

    const payload = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    let existing = parent.children.get(fileName);

    if (existing) {
      if (existing.type === 'dir') throw new Error(`EISDIR: illegal operation on a directory`);
      if (options?.append && existing.content) {
        const merged = new Uint8Array(existing.content.length + payload.length);
        merged.set(existing.content);
        merged.set(payload, existing.content.length);
        existing.content = merged;
      } else {
        existing.content = payload;
      }
      existing.mtime = Date.now();
    } else {
      parent.children.set(fileName, {
        name: fileName,
        type: 'file',
        content: payload,
        mtime: Date.now(),
      });
    }
  }

  public async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const parts = this.normalizePath(path);
    if (parts.length === 0) return;

    let current = this.root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!current.children) {
        current.children = new Map();
      }
      let next = current.children.get(part);
      if (!next) {
        if (!options?.recursive && i < parts.length - 1) {
          throw new Error(`ENOENT: no such file or directory, mkdir '${path}'`);
        }
        next = {
          name: part,
          type: 'dir',
          children: new Map(),
          mtime: Date.now(),
        };
        current.children.set(part, next);
      } else if (next.type !== 'dir') {
        throw new Error(`EEXIST: file exists, mkdir '${path}'`);
      }
      current = next;
    }
  }

  public async readDir(path: string): Promise<VFSFileEntry[]> {
    const parts = this.normalizePath(path);
    const node = this.getNode(parts);
    if (!node) throw new Error(`ENOENT: no such file or directory, scandir '${path}'`);
    if (node.type !== 'dir' || !node.children) throw new Error(`ENOTDIR: not a directory, scandir '${path}'`);

    const entries: VFSFileEntry[] = [];
    for (const [name, child] of node.children.entries()) {
      entries.push({
        name,
        type: child.type,
        size: child.type === 'file' ? child.content?.length || 0 : 4096,
        mtime: child.mtime,
      });
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
        mtime: this.root.mtime,
      };
    }
    const node = this.getNode(parts);
    if (!node) return null;
    return {
      name: node.name,
      type: node.type,
      size: node.type === 'file' ? node.content?.length || 0 : 4096,
      mtime: node.mtime,
    };
  }

  public async unlink(path: string): Promise<void> {
    const parts = this.normalizePath(path);
    if (parts.length === 0) throw new Error('Cannot unlink root');
    const name = parts.pop()!;
    const parent = this.getNode(parts);
    if (!parent || !parent.children) throw new Error(`ENOENT: no such file or directory`);
    const target = parent.children.get(name);
    if (!target) throw new Error(`ENOENT: no such file or directory`);
    if (target.type === 'dir') throw new Error(`EPERM: cannot unlink directory, use rmdir`);
    parent.children.delete(name);
  }

  public async rmdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const parts = this.normalizePath(path);
    if (parts.length === 0) throw new Error('Cannot remove root directory');
    const name = parts.pop()!;
    const parent = this.getNode(parts);
    if (!parent || !parent.children) throw new Error(`ENOENT: no such file or directory`);
    const target = parent.children.get(name);
    if (!target) throw new Error(`ENOENT: no such file or directory`);
    if (target.type !== 'dir') throw new Error(`ENOTDIR: not a directory`);
    if (!options?.recursive && target.children && target.children.size > 0) {
      throw new Error(`ENOTEMPTY: directory not empty`);
    }
    parent.children.delete(name);
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
