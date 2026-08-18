import { CommandContext } from '../types';
import { executeBuiltin, isBuiltinCommand } from './index';

export const sedCmd = async (ctx: CommandContext): Promise<number> => {
  if (ctx.args.length === 0) {
    ctx.stderr('sed: usage: sed "s/pattern/replacement/g" [file]\r\n');
    return 1;
  }

  let expr = ctx.args[0];
  let files = ctx.args.slice(1);

  if (expr === '-e' && ctx.args[1]) {
    expr = ctx.args[1];
    files = ctx.args.slice(2);
  }

  // Parse s/pattern/replacement/flags
  const match = expr.match(/^s\/(.*?)\/(.*?)\/([gimsuy]*)$/);
  if (!match) {
    ctx.stderr(`sed: unsupported or invalid expression: ${expr}\r\n`);
    return 1;
  }

  const [, pattern, replacement, flags] = match;
  const regex = new RegExp(pattern, flags);

  const applySed = (content: string) => {
    const lines = content.split(/\r?\n/);
    const transformed = lines.map((l) => l.replace(regex, replacement));
    ctx.stdout(transformed.join('\r\n') + '\r\n');
  };

  if (files.length === 0) {
    if (ctx.stdin) applySed(ctx.stdin);
  } else {
    for (const f of files) {
      try {
        const text = await ctx.vfs.readTextFile(f);
        applySed(text);
      } catch {
        ctx.stderr(`sed: cannot read ${f}: No such file or directory\r\n`);
      }
    }
  }
  return 0;
};

export const awkCmd = async (ctx: CommandContext): Promise<number> => {
  if (ctx.args.length === 0) {
    ctx.stderr('awk: usage: awk \'program\' [file]\r\n');
    return 1;
  }

  let delimiter = /\s+/;
  let program = '';
  const files: string[] = [];

  for (let i = 0; i < ctx.args.length; i++) {
    const arg = ctx.args[i];
    if (arg === '-F' && ctx.args[i + 1]) {
      delimiter = new RegExp(ctx.args[i + 1]);
      i++;
    } else if (!program) {
      program = arg;
    } else {
      files.push(arg);
    }
  }

  const runAwk = (content: string) => {
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      if (!line && lines.length > 1) continue;
      const fields = line.trim().split(delimiter);

      // Support basic {print $1, $2, ...} or {print}
      if (program.includes('print')) {
        const printMatch = program.match(/print\s+(.*?)[\};]/);
        if (printMatch) {
          const expr = printMatch[1].trim();
          if (!expr || expr === '$0') {
            ctx.stdout(line + '\r\n');
          } else {
            const fieldArgs = expr.split(',').map((s) => s.trim());
            const outputParts = fieldArgs.map((f) => {
              if (f.startsWith('$')) {
                const idx = parseInt(f.slice(1), 10);
                return idx === 0 ? line : fields[idx - 1] || '';
              }
              return f.replace(/["']/g, '');
            });
            ctx.stdout(outputParts.join(' ') + '\r\n');
          }
        } else {
          ctx.stdout(line + '\r\n');
        }
      } else {
        ctx.stdout(line + '\r\n');
      }
    }
  };

  if (files.length === 0) {
    if (ctx.stdin) runAwk(ctx.stdin);
  } else {
    for (const f of files) {
      try {
        const text = await ctx.vfs.readTextFile(f);
        runAwk(text);
      } catch {
        ctx.stderr(`awk: cannot open ${f}\r\n`);
      }
    }
  }
  return 0;
};

export const findCmd = async (ctx: CommandContext): Promise<number> => {
  const root = ctx.args[0] && !ctx.args[0].startsWith('-') ? ctx.args[0] : '.';
  let namePattern: RegExp | null = null;
  let typeFilter: 'file' | 'dir' | null = null;

  for (let i = 0; i < ctx.args.length; i++) {
    if (ctx.args[i] === '-name' && ctx.args[i + 1]) {
      const pat = ctx.args[i + 1].replace(/\*/g, '.*').replace(/\?/g, '.');
      namePattern = new RegExp(`^${pat}$`);
      i++;
    } else if (ctx.args[i] === '-type' && ctx.args[i + 1]) {
      typeFilter = ctx.args[i + 1] === 'd' ? 'dir' : 'file';
      i++;
    }
  }

  const traverse = async (dirPath: string, displayPrefix: string) => {
    const entries = await ctx.vfs.readDir(dirPath);
    for (const entry of entries) {
      const itemPath = `${dirPath}/${entry.name}`;
      const itemDisplay = `${displayPrefix}/${entry.name}`;

      const matchesName = !namePattern || namePattern.test(entry.name);
      const matchesType = !typeFilter || entry.type === typeFilter;

      if (matchesName && matchesType) {
        ctx.stdout(itemDisplay + '\r\n');
      }

      if (entry.type === 'dir') {
        await traverse(itemPath, itemDisplay);
      }
    }
  };

  try {
    const resolved = ctx.vfs.resolvePath(root);
    ctx.stdout(root + '\r\n');
    await traverse(resolved, root === '.' ? '.' : root);
    return 0;
  } catch (e: any) {
    ctx.stderr(`find: ${e.message}\r\n`);
    return 1;
  }
};

export const sortCmd = async (ctx: CommandContext): Promise<number> => {
  const reverse = ctx.args.includes('-r');
  const numeric = ctx.args.includes('-n');
  const unique = ctx.args.includes('-u');
  const files = ctx.args.filter((a) => !a.startsWith('-'));

  const doSort = (content: string) => {
    let lines = content.split(/\r?\n/).filter((l) => l.length > 0);
    if (unique) {
      lines = Array.from(new Set(lines));
    }
    lines.sort((a, b) => {
      if (numeric) {
        return (parseFloat(a) || 0) - (parseFloat(b) || 0);
      }
      return a.localeCompare(b);
    });
    if (reverse) lines.reverse();
    ctx.stdout(lines.join('\r\n') + '\r\n');
  };

  if (files.length === 0) {
    if (ctx.stdin) doSort(ctx.stdin);
  } else {
    for (const f of files) {
      try {
        const text = await ctx.vfs.readTextFile(f);
        doSort(text);
      } catch {
        ctx.stderr(`sort: ${f}: No such file or directory\r\n`);
      }
    }
  }
  return 0;
};

export const uniqCmd = async (ctx: CommandContext): Promise<number> => {
  const count = ctx.args.includes('-c');
  const files = ctx.args.filter((a) => !a.startsWith('-'));

  const doUniq = (content: string) => {
    const lines = content.split(/\r?\n/).filter((l) => l.length > 0);
    let prev = '';
    let currentCount = 0;

    for (let i = 0; i <= lines.length; i++) {
      const line = lines[i];
      if (line === prev) {
        currentCount++;
      } else {
        if (prev) {
          if (count) {
            ctx.stdout(`${currentCount.toString().padStart(7, ' ')} ${prev}\r\n`);
          } else {
            ctx.stdout(prev + '\r\n');
          }
        }
        prev = line;
        currentCount = 1;
      }
    }
  };

  if (files.length === 0) {
    if (ctx.stdin) doUniq(ctx.stdin);
  } else {
    for (const f of files) {
      try {
        const text = await ctx.vfs.readTextFile(f);
        doUniq(text);
      } catch {
        ctx.stderr(`uniq: ${f}: No such file or directory\r\n`);
      }
    }
  }
  return 0;
};

export const cutCmd = async (ctx: CommandContext): Promise<number> => {
  let delimiter = '\t';
  let fieldIdx = 1;
  const files: string[] = [];

  for (let i = 0; i < ctx.args.length; i++) {
    const arg = ctx.args[i];
    if (arg === '-d' && ctx.args[i + 1]) {
      delimiter = ctx.args[i + 1];
      i++;
    } else if (arg.startsWith('-d')) {
      delimiter = arg.slice(2);
    } else if (arg === '-f' && ctx.args[i + 1]) {
      fieldIdx = parseInt(ctx.args[i + 1], 10) || 1;
      i++;
    } else if (arg.startsWith('-f')) {
      fieldIdx = parseInt(arg.slice(2), 10) || 1;
    } else {
      files.push(arg);
    }
  }

  const doCut = (content: string) => {
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      if (!line) continue;
      const parts = line.split(delimiter);
      ctx.stdout((parts[fieldIdx - 1] || '') + '\r\n');
    }
  };

  if (files.length === 0) {
    if (ctx.stdin) doCut(ctx.stdin);
  } else {
    for (const f of files) {
      try {
        const text = await ctx.vfs.readTextFile(f);
        doCut(text);
      } catch {
        ctx.stderr(`cut: ${f}: No such file or directory\r\n`);
      }
    }
  }
  return 0;
};

export const trCmd = async (ctx: CommandContext): Promise<number> => {
  if (ctx.args.length < 2) {
    ctx.stderr('tr: usage: tr [SET1] [SET2]\r\n');
    return 1;
  }

  const from = ctx.args[0];
  const to = ctx.args[1];

  if (!ctx.stdin) return 0;

  if (from === 'a-z' && to === 'A-Z') {
    ctx.stdout(ctx.stdin.toUpperCase());
  } else if (from === 'A-Z' && to === 'a-z') {
    ctx.stdout(ctx.stdin.toLowerCase());
  } else {
    let result = ctx.stdin;
    for (let i = 0; i < from.length; i++) {
      const fromCh = from[i];
      const toCh = to[i] || '';
      result = result.split(fromCh).join(toCh);
    }
    ctx.stdout(result);
  }
  return 0;
};

export const base64Cmd = async (ctx: CommandContext): Promise<number> => {
  const decode = ctx.args.includes('-d') || ctx.args.includes('--decode');
  const files = ctx.args.filter((a) => !a.startsWith('-'));

  const processText = (text: string) => {
    try {
      if (decode) {
        ctx.stdout(atob(text.trim()) + '\r\n');
      } else {
        ctx.stdout(btoa(text) + '\r\n');
      }
    } catch (e: any) {
      ctx.stderr(`base64: error: ${e.message}\r\n`);
    }
  };

  if (files.length === 0) {
    if (ctx.stdin) processText(ctx.stdin);
  } else {
    for (const f of files) {
      try {
        const text = await ctx.vfs.readTextFile(f);
        processText(text);
      } catch {
        ctx.stderr(`base64: ${f}: No such file or directory\r\n`);
      }
    }
  }
  return 0;
};
