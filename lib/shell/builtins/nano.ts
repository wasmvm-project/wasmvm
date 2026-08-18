import { CommandContext } from '../types';

export const nanoCmd = async (ctx: CommandContext): Promise<number> => {
  const file = ctx.args[0];
  if (!file) {
    ctx.stderr('nano: please specify a file to edit (e.g. nano memo.txt)\r\n');
    return 1;
  }

  try {
    let content = '';
    const exists = await ctx.vfs.exists(file);
    if (exists) {
      content = await ctx.vfs.readTextFile(file);
    }

    ctx.stdout(`\r\n\x1b[1;44;37m  GNU nano (wasmvm edition) - ${file}  \x1b[0m\r\n`);
    ctx.stdout('\x1b[90m------------------------------------------------------------\x1b[0m\r\n');
    if (content) {
      ctx.stdout(content.replace(/\n/g, '\r\n') + '\r\n');
    } else {
      ctx.stdout('\x1b[33m[ New File ]\x1b[0m\r\n');
    }
    ctx.stdout('\x1b[90m------------------------------------------------------------\x1b[0m\r\n');
    ctx.stdout('\x1b[36mTip:\x1b[0m Use \x1b[32mecho "text" > ' + file + '\x1b[0m or the GUI File Explorer to edit files.\r\n\r\n');
    return 0;
  } catch (e: any) {
    ctx.stderr(`nano: ${e.message}\r\n`);
    return 1;
  }
};
