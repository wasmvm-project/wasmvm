import { CommandContext } from '../types';

export const sourceCmd = async (ctx: CommandContext): Promise<number> => {
  const file = ctx.args[0];
  if (!file) {
    ctx.stderr('source: filename argument required\r\n');
    return 1;
  }

  try {
    const script = await ctx.vfs.readTextFile(file);
    const lines = script.split(/\r?\n/);

    // Dynamic import to avoid circular dependency
    const { Shell } = await import('../shell');
    const shell = new Shell((text) => ctx.stdout(text));

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      await shell.executeCommandLine(trimmed);
    }
    return 0;
  } catch (e: any) {
    ctx.stderr(`source: cannot read '${file}': ${e.message}\r\n`);
    return 1;
  }
};

export const shCmd = async (ctx: CommandContext): Promise<number> => {
  if (ctx.args.length === 0) {
    ctx.stdout('wasmvm subshell (sh)\r\n');
    return 0;
  }

  if (ctx.args[0] === '-c' && ctx.args[1]) {
    const { Shell } = await import('../shell');
    const shell = new Shell((text) => ctx.stdout(text));
    return await shell.executeCommandLine(ctx.args[1]);
  }

  // Script file
  return await sourceCmd(ctx);
};
