import { VFSManager } from '../vfs/vfs-manager';

export class GlobMatcher {
  /**
   * 単純な glob パターン（*, ?）を正規表現に変換
   */
  public static patternToRegex(pattern: string): RegExp {
    let regexStr = '^';
    for (let i = 0; i < pattern.length; i++) {
      const c = pattern[i];
      if (c === '*') {
        regexStr += '.*';
      } else if (c === '?') {
        regexStr += '.';
      } else if (['.', '(', ')', '+', '{', '}', '[', ']', '^', '$', '|', '\\'].includes(c)) {
        regexStr += '\\' + c;
      } else {
        regexStr += c;
      }
    }
    regexStr += '$';
    return new RegExp(regexStr);
  }

  /**
   * 引数リスト内のワイルドカード（* or ?）を展開
   */
  public static async expandArgs(args: string[], vfs: VFSManager): Promise<string[]> {
    const expanded: string[] = [];

    for (const arg of args) {
      if (!arg.includes('*') && !arg.includes('?')) {
        expanded.push(arg);
        continue;
      }

      try {
        let searchDir = vfs.getCwd();
        let pattern = arg;

        if (arg.includes('/')) {
          const lastSlash = arg.lastIndexOf('/');
          const dirPart = arg.slice(0, lastSlash) || '/';
          pattern = arg.slice(lastSlash + 1);
          searchDir = vfs.resolvePath(dirPart);
        }

        const entries = await vfs.readDir(searchDir);
        const regex = this.patternToRegex(pattern);
        const matches = entries
          .filter((e) => {
            if (pattern.startsWith('.')) return regex.test(e.name);
            return !e.name.startsWith('.') && regex.test(e.name);
          })
          .map((e) => {
            const dirPrefix = arg.includes('/') ? arg.slice(0, arg.lastIndexOf('/') + 1) : '';
            return dirPrefix + e.name;
          });

        if (matches.length > 0) {
          expanded.push(...matches);
        } else {
          // マッチしない場合はそのまま
          expanded.push(arg);
        }
      } catch {
        expanded.push(arg);
      }
    }

    return expanded;
  }
}
