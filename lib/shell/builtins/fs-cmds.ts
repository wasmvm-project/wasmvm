import { CommandContext } from '../types';

export const pwdCmd = async (ctx: CommandContext): Promise<number> => {
  ctx.stdout(ctx.vfs.getCwd() + '\r\n');
  return 0;
};

export const cdCmd = async (ctx: CommandContext): Promise<number> => {
  const target = ctx.args[0] || ctx.env.get('HOME') || '/home/user';
  try {
    const resolved = ctx.vfs.resolvePath(target);
    const stat = await ctx.vfs.stat(resolved);
    if (!stat) {
      ctx.stderr(`cd: no such file or directory: ${target}\r\n`);
      return 1;
    }
    if (stat.type !== 'dir') {
      ctx.stderr(`cd: not a directory: ${target}\r\n`);
      return 1;
    }
    ctx.vfs.setCwd(resolved);
    return 0;
  } catch (e: any) {
    ctx.stderr(`cd: ${e.message}\r\n`);
    return 1;
  }
};

export const lsCmd = async (ctx: CommandContext): Promise<number> => {
  const flags = new Set<string>();
  const paths: string[] = [];

  for (const arg of ctx.args) {
    if (arg.startsWith('-') && arg.length > 1) {
      for (const ch of arg.slice(1)) {
        flags.add(ch);
      }
    } else {
      paths.push(arg);
    }
  }

  const showAll = flags.has('a');
  const longFormat = flags.has('l');
  const humanReadable = flags.has('h');

  const targets = paths.length > 0 ? paths : ['.'];

  const formatSize = (bytes: number): string => {
    if (!humanReadable) return bytes.toString().padStart(8, ' ');
    if (bytes < 1024) return `${bytes}B`.padStart(6, ' ');
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`.padStart(6, ' ');
    return `${(bytes / (1024 * 1024)).toFixed(1)}M`.padStart(6, ' ');
  };

  const formatDate = (timestamp: number): string => {
    const d = new Date(timestamp);
    const month = d.toLocaleString('en-US', { month: 'short' });
    const day = d.getDate().toString().padStart(2, ' ');
    const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    return `${month} ${day} ${time}`;
  };

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const resolved = ctx.vfs.resolvePath(target);

    try {
      const stat = await ctx.vfs.stat(resolved);
      if (!stat) {
        ctx.stderr(`ls: cannot access '${target}': No such file or directory\r\n`);
        continue;
      }

      if (stat.type === 'file') {
        if (longFormat) {
          ctx.stdout(`-rw-r--r-- 1 user user ${formatSize(stat.size)} ${formatDate(stat.mtime)} \x1b[32m${stat.name}\x1b[0m\r\n`);
        } else {
          ctx.stdout(`\x1b[32m${stat.name}\x1b[0m\r\n`);
        }
        continue;
      }

      if (targets.length > 1) {
        ctx.stdout(`${target}:\r\n`);
      }

      const entries = await ctx.vfs.readDir(resolved);
      const filtered = entries.filter((e) => showAll || !e.name.startsWith('.'));

      if (longFormat) {
        let total = 0;
        filtered.forEach((e) => (total += e.size));
        ctx.stdout(`total ${Math.ceil(total / 1024)}\r\n`);

        for (const entry of filtered) {
          const isDir = entry.type === 'dir';
          const perms = isDir ? 'drwxr-xr-x' : '-rw-r--r--';
          const colorName = isDir ? `\x1b[1;34m${entry.name}/\x1b[0m` : `\x1b[32m${entry.name}\x1b[0m`;
          ctx.stdout(`${perms} 1 user user ${formatSize(entry.size)} ${formatDate(entry.mtime)} ${colorName}\r\n`);
        }
      } else {
        const formatted = filtered.map((e) => {
          return e.type === 'dir' ? `\x1b[1;34m${e.name}/\x1b[0m` : `\x1b[32m${e.name}\x1b[0m`;
        });
        if (formatted.length > 0) {
          ctx.stdout(formatted.join('  ') + '\r\n');
        }
      }
    } catch (e: any) {
      ctx.stderr(`ls: cannot access '${target}': ${e.message}\r\n`);
    }
  }
  return 0;
};

export const catCmd = async (ctx: CommandContext): Promise<number> => {
  if (ctx.args.length === 0) {
    if (ctx.stdin) {
      ctx.stdout(ctx.stdin);
      return 0;
    }
    return 0;
  }

  for (const file of ctx.args) {
    try {
      const text = await ctx.vfs.readTextFile(file);
      ctx.stdout(text.replace(/\n/g, '\r\n'));
      if (!text.endsWith('\n')) {
        ctx.stdout('\r\n');
      }
    } catch (e: any) {
      ctx.stderr(`cat: ${file}: No such file or directory\r\n`);
      return 1;
    }
  }
  return 0;
};

export const touchCmd = async (ctx: CommandContext): Promise<number> => {
  if (ctx.args.length === 0) {
    ctx.stderr('touch: missing file operand\r\n');
    return 1;
  }

  for (const file of ctx.args) {
    try {
      if (!(await ctx.vfs.exists(file))) {
        await ctx.vfs.writeFile(file, '');
      }
    } catch (e: any) {
      ctx.stderr(`touch: cannot touch '${file}': ${e.message}\r\n`);
      return 1;
    }
  }
  return 0;
};

export const mkdirCmd = async (ctx: CommandContext): Promise<number> => {
  const recursive = ctx.args.includes('-p');
  const dirs = ctx.args.filter((a) => a !== '-p');

  if (dirs.length === 0) {
    ctx.stderr('mkdir: missing operand\r\n');
    return 1;
  }

  for (const dir of dirs) {
    try {
      await ctx.vfs.mkdir(dir, { recursive });
    } catch (e: any) {
      ctx.stderr(`mkdir: cannot create directory '${dir}': ${e.message}\r\n`);
      return 1;
    }
  }
  return 0;
};

export const rmCmd = async (ctx: CommandContext): Promise<number> => {
  const flags = new Set(ctx.args.filter((a) => a.startsWith('-')).join(''));
  const recursive = flags.has('r') || flags.has('R');
  const force = flags.has('f');
  const targets = ctx.args.filter((a) => !a.startsWith('-'));

  if (targets.length === 0) {
    if (!force) ctx.stderr('rm: missing operand\r\n');
    return force ? 0 : 1;
  }

  for (const target of targets) {
    try {
      const stat = await ctx.vfs.stat(target);
      if (!stat) {
        if (!force) ctx.stderr(`rm: cannot remove '${target}': No such file or directory\r\n`);
        continue;
      }

      if (stat.type === 'dir') {
        if (!recursive) {
          ctx.stderr(`rm: cannot remove '${target}': Is a directory\r\n`);
          return 1;
        }
        await ctx.vfs.rmdir(target, { recursive: true });
      } else {
        await ctx.vfs.unlink(target);
      }
    } catch (e: any) {
      if (!force) ctx.stderr(`rm: cannot remove '${target}': ${e.message}\r\n`);
    }
  }
  return 0;
};

export const cpCmd = async (ctx: CommandContext): Promise<number> => {
  if (ctx.args.length < 2) {
    ctx.stderr('cp: missing file operand\r\n');
    return 1;
  }

  const src = ctx.args[0];
  const dest = ctx.args[1];

  try {
    const data = await ctx.vfs.readFile(src);
    let targetPath = dest;
    const destStat = await ctx.vfs.stat(dest);
    if (destStat && destStat.type === 'dir') {
      const srcName = src.split('/').pop() || 'file';
      targetPath = `${dest}/${srcName}`;
    }
    await ctx.vfs.writeFile(targetPath, data);
    return 0;
  } catch (e: any) {
    ctx.stderr(`cp: cannot copy '${src}' to '${dest}': ${e.message}\r\n`);
    return 1;
  }
};

export const mvCmd = async (ctx: CommandContext): Promise<number> => {
  if (ctx.args.length < 2) {
    ctx.stderr('mv: missing file operand\r\n');
    return 1;
  }

  const src = ctx.args[0];
  const dest = ctx.args[1];

  try {
    let targetPath = dest;
    const destStat = await ctx.vfs.stat(dest);
    if (destStat && destStat.type === 'dir') {
      const srcName = src.split('/').pop() || 'file';
      targetPath = `${dest}/${srcName}`;
    }
    await ctx.vfs.rename(src, targetPath);
    return 0;
  } catch (e: any) {
    ctx.stderr(`mv: cannot move '${src}' to '${dest}': ${e.message}\r\n`);
    return 1;
  }
};
