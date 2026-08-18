import { VFSManager } from '../vfs/vfs-manager';

export interface CompletionResult {
  completed: string;
  candidates: string[];
  prefix: string;
}

export class CompletionManager {
  private vfs: VFSManager;
  private builtinNames: string[];

  constructor(vfs: VFSManager, builtinNames: string[]) {
    this.vfs = vfs;
    this.builtinNames = builtinNames;
  }

  public setBuiltinNames(names: string[]) {
    this.builtinNames = names;
  }

  public async complete(input: string): Promise<CompletionResult> {
    const trimmed = input;
    const lastSpaceIndex = trimmed.lastIndexOf(' ');

    if (lastSpaceIndex === -1) {
      // コマンド名の補完
      return this.completeCommand(trimmed);
    } else {
      // 引数（ファイルパス）の補完
      const before = trimmed.slice(0, lastSpaceIndex + 1);
      const arg = trimmed.slice(lastSpaceIndex + 1);
      const pathRes = await this.completePath(arg);
      return {
        completed: before + pathRes.completed,
        candidates: pathRes.candidates,
        prefix: pathRes.prefix,
      };
    }
  }

  private completeCommand(prefix: string): CompletionResult {
    // Builtinコマンド + /bin 内の実行可能ファイル
    const candidates = this.builtinNames.filter((name) => name.startsWith(prefix));
    if (candidates.length === 0) {
      return { completed: prefix, candidates: [], prefix };
    }

    if (candidates.length === 1) {
      return {
        completed: candidates[0] + ' ',
        candidates,
        prefix,
      };
    }

    // 共通プレフィックスを計算
    const common = this.findCommonPrefix(candidates);
    return {
      completed: common,
      candidates,
      prefix,
    };
  }

  private async completePath(argPath: string): Promise<CompletionResult> {
    try {
      let searchDir = this.vfs.getCwd();
      let filePrefix = argPath;

      if (argPath.includes('/')) {
        const lastSlash = argPath.lastIndexOf('/');
        const dirPart = argPath.slice(0, lastSlash) || '/';
        filePrefix = argPath.slice(lastSlash + 1);
        searchDir = this.vfs.resolvePath(dirPart);
      }

      const entries = await this.vfs.readDir(searchDir);
      const matches = entries.filter((e) => e.name.startsWith(filePrefix));

      if (matches.length === 0) {
        return { completed: argPath, candidates: [], prefix: filePrefix };
      }

      const candidateNames = matches.map((m) => m.name + (m.type === 'dir' ? '/' : ''));

      if (matches.length === 1) {
        const match = matches[0];
        const dirPrefix = argPath.includes('/') ? argPath.slice(0, argPath.lastIndexOf('/') + 1) : '';
        const completed = dirPrefix + match.name + (match.type === 'dir' ? '/' : ' ');
        return {
          completed,
          candidates: candidateNames,
          prefix: filePrefix,
        };
      }

      // 複数ある場合
      const common = this.findCommonPrefix(matches.map((m) => m.name));
      const dirPrefix = argPath.includes('/') ? argPath.slice(0, argPath.lastIndexOf('/') + 1) : '';
      return {
        completed: dirPrefix + common,
        candidates: candidateNames,
        prefix: filePrefix,
      };
    } catch {
      return { completed: argPath, candidates: [], prefix: argPath };
    }
  }

  private findCommonPrefix(strings: string[]): string {
    if (strings.length === 0) return '';
    let prefix = strings[0];
    for (let i = 1; i < strings.length; i++) {
      while (!strings[i].startsWith(prefix)) {
        prefix = prefix.slice(0, -1);
        if (!prefix) return '';
      }
    }
    return prefix;
  }
}
