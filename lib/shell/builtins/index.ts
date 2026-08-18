import { BuiltinCommandFn, CommandContext } from '../types';
import { cdCmd, cpCmd, lsCmd, mkdirCmd, mvCmd, pwdCmd, rmCmd, touchCmd, catCmd } from './fs-cmds';
import { echoCmd, grepCmd, headCmd, tailCmd, wcCmd } from './text-cmds';
import { clearCmd, curlCmd, dateCmd, envCmd, exportCmd, helpCmd, unameCmd } from './sys-cmds';
import { wpmCmd } from './wpm-cmd';
import { nanoCmd } from './nano';
import { aliasCmd, unaliasCmd } from './alias-cmds';
import { sedCmd, awkCmd, findCmd, sortCmd, uniqCmd, cutCmd, trCmd, base64Cmd } from './busybox-cmds';
import { sourceCmd, shCmd } from './script-cmds';
import { gitCmd } from './git-cmd';
import { codeCmd } from './editor-cmds';
import { mountLocalCmd } from './mount-cmd';
import { pythonCmd } from './python-cmd';
import { sqliteCmd } from './sqlite-cmd';
import { nodeCmd } from './js-cmd';

export const BUILTIN_COMMANDS: Record<string, BuiltinCommandFn> = {
  // File System
  cd: cdCmd,
  pwd: pwdCmd,
  ls: lsCmd,
  cat: catCmd,
  touch: touchCmd,
  mkdir: mkdirCmd,
  rm: rmCmd,
  cp: cpCmd,
  mv: mvCmd,

  // Text Processing & BusyBox tools
  echo: echoCmd,
  grep: grepCmd,
  head: headCmd,
  tail: tailCmd,
  wc: wcCmd,
  sed: sedCmd,
  awk: awkCmd,
  find: findCmd,
  sort: sortCmd,
  uniq: uniqCmd,
  cut: cutCmd,
  tr: trCmd,
  base64: base64Cmd,

  // Programming & Runtimes (Real WebAssembly Engines)
  python: pythonCmd,
  python3: pythonCmd,
  py: pythonCmd,
  sqlite3: sqliteCmd,
  sqlite: sqliteCmd,
  node: nodeCmd,
  quickjs: nodeCmd,
  js: nodeCmd,

  // Shell Scripting & Aliases
  alias: aliasCmd,
  unalias: unaliasCmd,
  source: sourceCmd,
  '.': sourceCmd,
  sh: shCmd,
  bash: shCmd,

  // Development & VCS
  git: gitCmd,
  code: codeCmd,
  edit: codeCmd,
  nano: nanoCmd,
  vi: nanoCmd,
  vim: nanoCmd,

  // System & Utilities
  clear: clearCmd,
  cls: clearCmd,
  env: envCmd,
  export: exportCmd,
  uname: unameCmd,
  date: dateCmd,
  help: helpCmd,
  curl: curlCmd,
  fetch: curlCmd,
  wpm: wpmCmd,
  'mount-local': mountLocalCmd,
};

export const getBuiltinNames = (): string[] => {
  return Object.keys(BUILTIN_COMMANDS);
};

export const isBuiltinCommand = (name: string): boolean => {
  return name in BUILTIN_COMMANDS;
};

export const executeBuiltin = async (
  name: string,
  ctx: CommandContext
): Promise<number> => {
  const fn = BUILTIN_COMMANDS[name];
  if (!fn) {
    ctx.stderr(`${name}: command not found\r\n`);
    return 127;
  }
  const result = await fn(ctx);
  return typeof result === 'number' ? result : 0;
};
