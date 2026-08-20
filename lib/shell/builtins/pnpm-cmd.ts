import { CommandContext } from '../types';

export const pnpmCmd = async (ctx: CommandContext): Promise<number> => {
  const subCmd = ctx.args[0];
  if (!subCmd) {
    ctx.stderr('pnpm: missing command (try: pnpm install <pkg>)\\r\\n');
    return 1;
  }

  if (subCmd === 'install' || subCmd === 'i' || subCmd === 'add') {
    const pkg = ctx.args[1];
    if (!pkg) {
      ctx.stderr('pnpm: missing package name\\r\\n');
      return 1;
    }

    ctx.stdout(`\\x1b[36m[pnpm]\x1b[0m Resolving ${pkg} via esm.sh...\\r\\n`);
    try {
      // Fetch the bundle from esm.sh
      const res = await fetch(`https://esm.sh/${pkg}?bundle`);
      if (!res.ok) {
        ctx.stderr(`pnpm: failed to fetch package ${pkg} (status ${res.status})\\r\\n`);
        return 1;
      }
      const code = await res.text();
      const pwd = ctx.env.get('PWD') || '/home/user';
      
      const nodeModulesDir = `${pwd}/node_modules`;
      if (!(await ctx.vfs.exists(nodeModulesDir))) {
        await ctx.vfs.mkdir(nodeModulesDir);
      }
      
      const pkgPath = `${nodeModulesDir}/${pkg}.js`;
      await ctx.vfs.writeFile(pkgPath, new TextEncoder().encode(code));
      ctx.stdout(`\\x1b[36m[pnpm]\x1b[0m Downloaded ${pkg} to ${pkgPath}\\r\\n`);

      // Update import_map.json
      const importMapPath = `${pwd}/import_map.json`;
      let importMap: any = { imports: {} };
      if (await ctx.vfs.exists(importMapPath)) {
        try {
          const content = await ctx.vfs.readTextFile(importMapPath);
          importMap = JSON.parse(content);
        } catch (e) {
          ctx.stderr(`pnpm: warning, could not parse existing import_map.json\\r\\n`);
        }
      }
      
      if (!importMap.imports) importMap.imports = {};
      importMap.imports[pkg] = `/opfs${pkgPath}`;
      
      await ctx.vfs.writeFile(importMapPath, new TextEncoder().encode(JSON.stringify(importMap, null, 2)));
      ctx.stdout(`\\x1b[36m[pnpm]\x1b[0m Updated import_map.json\\r\\n`);
      ctx.stdout(`\\x1b[32m[pnpm]\x1b[0m Successfully installed ${pkg}!\\r\\n`);
      
      return 0;
    } catch (e: any) {
      ctx.stderr(`pnpm error: ${e.message}\\r\\n`);
      return 1;
    }
  }

  ctx.stderr(`pnpm: unknown command '${subCmd}'\\r\\n`);
  return 1;
};
