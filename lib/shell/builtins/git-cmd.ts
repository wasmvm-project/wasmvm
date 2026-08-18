import { CommandContext } from '../types';
import * as git from 'isomorphic-git';

function createEnoentError(path: string): Error {
  const err: any = new Error(`ENOENT: no such file or directory, stat '${path}'`);
  err.code = 'ENOENT';
  err.errno = -2;
  return err;
}

export const gitCmd = async (ctx: CommandContext): Promise<number> => {
  const subCmd = ctx.args[0] || 'help';
  const args = ctx.args.slice(1);
  const cwd = ctx.vfs.getCwd();

  const resolvePath = (p: string) => {
    return ctx.vfs.resolvePath(p);
  };

  const readFileFn = async (filepath: string, options?: any) => {
    try {
      const resolved = resolvePath(filepath);
      const data = await ctx.vfs.readFile(resolved);
      const encoding = typeof options === 'string' ? options : options && options.encoding;
      if (encoding === 'utf8' || encoding === 'utf-8') {
        return new TextDecoder().decode(data);
      }
      return data;
    } catch {
      throw createEnoentError(filepath);
    }
  };

  const writeFileFn = async (filepath: string, data: any) => {
    const resolved = resolvePath(filepath);
    await ctx.vfs.writeFile(resolved, data);
  };

  const unlinkFn = async (filepath: string) => {
    try {
      const resolved = resolvePath(filepath);
      await ctx.vfs.unlink(resolved);
    } catch {
      throw createEnoentError(filepath);
    }
  };

  const readdirFn = async (filepath: string) => {
    try {
      const resolved = resolvePath(filepath);
      const entries = await ctx.vfs.readDir(resolved);
      return entries.map((e) => e.name);
    } catch {
      throw createEnoentError(filepath);
    }
  };

  const mkdirFn = async (filepath: string) => {
    const resolved = resolvePath(filepath);
    await ctx.vfs.mkdir(resolved, { recursive: true });
  };

  const rmdirFn = async (filepath: string) => {
    try {
      const resolved = resolvePath(filepath);
      await ctx.vfs.rmdir(resolved, { recursive: true });
    } catch {
      throw createEnoentError(filepath);
    }
  };

  const statFn = async (filepath: string) => {
    const resolved = resolvePath(filepath);
    const s = await ctx.vfs.stat(resolved);
    if (!s) {
      throw createEnoentError(filepath);
    }
    const isDir = s.type === 'dir';
    const mdate = new Date(s.mtime);
    return {
      isFile: () => !isDir,
      isDirectory: () => isDir,
      isSymbolicLink: () => false,
      size: s.size,
      mtimeMs: s.mtime,
      mtime: mdate,
      ctime: mdate,
      ctimeMs: s.mtime,
      ino: 1,
      dev: 1,
      uid: 1,
      gid: 1,
      mode: isDir ? 0o777 : 0o666,
    };
  };

  const fsPromises = {
    readFile: readFileFn,
    writeFile: writeFileFn,
    unlink: unlinkFn,
    readdir: readdirFn,
    mkdir: mkdirFn,
    rmdir: rmdirFn,
    stat: statFn,
    lstat: statFn,
    readlink: async (p: string) => {
      throw createEnoentError(p);
    },
    symlink: async () => {},
  };

  const fs = {
    promises: fsPromises,
    ...fsPromises,
  };

  try {
    if (subCmd === 'init') {
      await git.init({ fs, dir: cwd });
      ctx.stdout(`Initialized empty Git repository in ${cwd}/.git/\r\n`);
      return 0;
    }

    if (subCmd === 'status') {
      const isGitRepo = await ctx.vfs.exists(`${cwd}/.git`);
      if (!isGitRepo) {
        ctx.stderr('fatal: not a git repository (or any of the parent directories): .git\r\n');
        return 1;
      }

      const files = await git.statusMatrix({ fs, dir: cwd });
      ctx.stdout(`On branch main\r\n\r\n`);

      const untracked: string[] = [];
      const modified: string[] = [];
      const staged: string[] = [];

      for (const [file, head, workdir, stage] of files) {
        if (head === 0 && workdir === 2 && stage === 0) {
          untracked.push(file);
        } else if (workdir === 2 && stage === 2) {
          staged.push(file);
        } else if (workdir === 2 && stage === 1) {
          modified.push(file);
        }
      }

      if (staged.length > 0) {
        ctx.stdout('\x1b[32mChanges to be committed:\x1b[0m\r\n');
        staged.forEach((f) => ctx.stdout(`\t\x1b[32mnew file:   ${f}\x1b[0m\r\n`));
      }

      if (modified.length > 0) {
        ctx.stdout('\x1b[31mChanges not staged for commit:\x1b[0m\r\n');
        modified.forEach((f) => ctx.stdout(`\t\x1b[31mmodified:   ${f}\x1b[0m\r\n`));
      }

      if (untracked.length > 0) {
        ctx.stdout('\x1b[31mUntracked files:\x1b[0m\r\n');
        untracked.forEach((f) => ctx.stdout(`\t\x1b[31m${f}\x1b[0m\r\n`));
      }

      if (staged.length === 0 && modified.length === 0 && untracked.length === 0) {
        ctx.stdout('nothing to commit, working tree clean\r\n');
      }
      return 0;
    }

    if (subCmd === 'add') {
      const target = args[0] || '.';
      const isGitRepo = await ctx.vfs.exists(`${cwd}/.git`);
      if (!isGitRepo) {
        ctx.stderr('fatal: not a git repository: .git\r\n');
        return 1;
      }

      if (target === '.' || target === '-A') {
        const entries = await ctx.vfs.readDir(cwd);
        for (const entry of entries) {
          if (entry.name === '.git') continue;
          await git.add({ fs, dir: cwd, filepath: entry.name });
        }
      } else {
        await git.add({ fs, dir: cwd, filepath: target });
      }
      return 0;
    }

    if (subCmd === 'commit') {
      let msg = '';
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-m' && args[i + 1]) {
          msg = args[i + 1];
          break;
        }
      }

      if (!msg) {
        ctx.stderr('error: please provide a commit message with -m "message"\r\n');
        return 1;
      }

      const author = {
        name: (ctx.env.get('USER') as string) || 'User',
        email: 'user@wasmvm.local',
      };

      const sha = await git.commit({
        fs,
        dir: cwd,
        message: msg,
        author,
      });

      ctx.stdout(`[main (root-commit) ${sha.slice(0, 7)}] ${msg}\r\n`);
      return 0;
    }

    if (subCmd === 'log') {
      const commits = await git.log({ fs, dir: cwd, depth: 10 });
      for (const c of commits) {
        ctx.stdout(`\x1b[33mcommit ${c.oid}\x1b[0m\r\n`);
        ctx.stdout(`Author: ${c.commit.author.name} <${c.commit.author.email}>\r\n`);
        ctx.stdout(`Date:   ${new Date(c.commit.author.timestamp * 1000).toISOString()}\r\n\r\n`);
        ctx.stdout(`    ${c.commit.message}\r\n\r\n`);
      }
      return 0;
    }

    if (subCmd === 'clone') {
      const url = args[0];
      if (!url) {
        ctx.stderr('fatal: You must specify a repository to clone.\r\n');
        return 1;
      }
      const dirName = url.split('/').pop()?.replace('.git', '') || 'repo';
      const targetDir = `${cwd}/${dirName}`;
      ctx.stdout(`Cloning into '${dirName}'...\r\n`);

      const corsProxy = 'https://cors.isomorphic-git.org';
      try {
        await git.clone({
          fs,
          http: (window as any).isomorphicGitHttp || undefined,
          dir: targetDir,
          corsProxy,
          url,
          singleBranch: true,
          depth: 1,
        });
        ctx.stdout(`Clone completed successfully to ${targetDir}\r\n`);
        return 0;
      } catch (e: any) {
        ctx.stderr(`git clone error (CORS or network): ${e.message}\r\n`);
        return 1;
      }
    }

    // Help
    const helpText = `
\x1b[1;36mGit (isomorphic-git in browser OPFS)\x1b[0m

Usage:
  git init                 Create an empty Git repository in current folder
  git status               Show the working tree status
  git add <file>           Add file contents to the index
  git commit -m <msg>      Record changes to the repository
  git log                  Show commit logs
  git clone <url>          Clone a repository into a new directory
`;
    ctx.stdout(helpText.replace(/\n/g, '\r\n'));
    return 0;
  } catch (e: any) {
    ctx.stderr(`git error: ${e.message}\r\n`);
    return 1;
  }
};
