import { CommandContext } from '../types';
import { AliasManager } from '../alias';

export const aliasCmd = async (ctx: CommandContext): Promise<number> => {
  const aliasMgr = AliasManager.getInstance();

  if (ctx.args.length === 0) {
    const all = aliasMgr.getAll();
    for (const [k, v] of all.entries()) {
      ctx.stdout(`alias ${k}='${v}'\r\n`);
    }
    return 0;
  }

  for (const arg of ctx.args) {
    const eqIdx = arg.indexOf('=');
    if (eqIdx !== -1) {
      const name = arg.slice(0, eqIdx);
      let value = arg.slice(eqIdx + 1);
      // Remove surrounding quotes if present
      if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
        value = value.slice(1, -1);
      }
      aliasMgr.set(name, value);
    } else {
      const val = aliasMgr.get(arg);
      if (val) {
        ctx.stdout(`alias ${arg}='${val}'\r\n`);
      } else {
        ctx.stderr(`alias: ${arg}: not found\r\n`);
        return 1;
      }
    }
  }

  return 0;
};

export const unaliasCmd = async (ctx: CommandContext): Promise<number> => {
  const aliasMgr = AliasManager.getInstance();
  if (ctx.args.length === 0) {
    ctx.stderr('unalias: usage: unalias name [name ...]\r\n');
    return 1;
  }

  let hasError = false;
  for (const name of ctx.args) {
    const success = aliasMgr.remove(name);
    if (!success) {
      ctx.stderr(`unalias: ${name}: not found\r\n`);
      hasError = true;
    }
  }

  return hasError ? 1 : 0;
};
