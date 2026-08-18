export type FileType = 'file' | 'dir';

export interface VFSStat {
  name: string;
  type: FileType;
  size: number;
  mtime: number;
  mode?: number;
}

export interface VFSFileEntry {
  name: string;
  type: FileType;
  size: number;
  mtime: number;
}

export interface IVirtualFileSystem {
  init(): Promise<void>;
  readFile(path: string): Promise<Uint8Array>;
  readTextFile(path: string): Promise<string>;
  writeFile(
    path: string,
    data: Uint8Array | string,
    options?: { append?: boolean; create?: boolean }
  ): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  readDir(path: string): Promise<VFSFileEntry[]>;
  stat(path: string): Promise<VFSStat | null>;
  unlink(path: string): Promise<void>;
  rmdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  exists(path: string): Promise<boolean>;
  rename(oldPath: string, newPath: string): Promise<void>;
}
