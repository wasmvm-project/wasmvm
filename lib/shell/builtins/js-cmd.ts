import { CommandContext } from '../types';

export const nodeCmd = async (ctx: CommandContext): Promise<number> => {
  const args = ctx.args;

  // node -e "code"
  if (args[0] === '-e' && args[1]) {
    const code = args.slice(1).join(' ');
    try {
      const logs: string[] = [];
      const customConsole = {
        log: (...a: any[]) => logs.push(a.map(String).join(' ')),
        error: (...a: any[]) => logs.push('\x1b[31m' + a.map(String).join(' ') + '\x1b[0m'),
        warn: (...a: any[]) => logs.push('\x1b[33m' + a.map(String).join(' ') + '\x1b[0m'),
      };

      const fn = new Function('console', 'fetch', code);
      const res = fn(customConsole, fetch);
      if (res instanceof Promise) {
        await res;
      }
      if (logs.length > 0) {
        ctx.stdout(logs.join('\r\n') + '\r\n');
      }
      return 0;
    } catch (e: any) {
      ctx.stderr(`Node/JS Error: ${e.message}\r\n`);
      return 1;
    }
  }

  // node script.js
  if (args.length > 0 && !args[0].startsWith('-')) {
    const scriptPath = args[0];
    try {
      const code = await ctx.vfs.readTextFile(scriptPath);
      const logs: string[] = [];
      const customConsole = {
        log: (...a: any[]) => logs.push(a.map(String).join(' ')),
        error: (...a: any[]) => logs.push('\x1b[31m' + a.map(String).join(' ') + '\x1b[0m'),
        warn: (...a: any[]) => logs.push('\x1b[33m' + a.map(String).join(' ') + '\x1b[0m'),
      };

      const fn = new Function('console', 'fetch', code);
      const res = fn(customConsole, fetch);
      if (res instanceof Promise) {
        await res;
      }
      if (logs.length > 0) {
        ctx.stdout(logs.join('\r\n') + '\r\n');
      }
      return 0;
    } catch (e: any) {
      ctx.stderr(`node: error executing '${scriptPath}': ${e.message}\r\n`);
      return 1;
    }
  }

  // stdin via pipe
  if (ctx.stdin) {
    try {
      const logs: string[] = [];
      const customConsole = {
        log: (...a: any[]) => logs.push(a.map(String).join(' ')),
        error: (...a: any[]) => logs.push('\x1b[31m' + a.map(String).join(' ') + '\x1b[0m'),
        warn: (...a: any[]) => logs.push('\x1b[33m' + a.map(String).join(' ') + '\x1b[0m'),
      };

      const fn = new Function('console', 'fetch', ctx.stdin);
      const res = fn(customConsole, fetch);
      if (res instanceof Promise) {
        await res;
      }
      if (logs.length > 0) {
        ctx.stdout(logs.join('\r\n') + '\r\n');
      }
      return 0;
    } catch (e: any) {
      ctx.stderr(`JS Error: ${e.message}\r\n`);
      return 1;
    }
  }

  // Info
  ctx.stdout(`
\x1b[1;36mNode.js / QuickJS JavaScript Runner (wasmvm)\x1b[0m
Usage:
  node script.js         Execute a JavaScript file
  node -e "code"         Execute inline JavaScript code
  echo "console.log(1)" | node
\r\n`);
  return 0;
};
