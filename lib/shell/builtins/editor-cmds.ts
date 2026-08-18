import { CommandContext } from '../types';

export const codeCmd = async (ctx: CommandContext): Promise<number> => {
  const file = ctx.args[0];
  if (!file) {
    ctx.stderr('code: please specify a file (e.g. code index.ts)\r\n');
    return 1;
  }

  const resolved = ctx.vfs.resolvePath(file);
  // Dispatch custom browser event to open Monaco editor
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('wasmvm:open-editor', {
      detail: { path: resolved },
    });
    window.dispatchEvent(event);
    ctx.stdout(`[code] Opened '${file}' in Monaco Editor\r\n`);
    return 0;
  }
  return 0;
};
