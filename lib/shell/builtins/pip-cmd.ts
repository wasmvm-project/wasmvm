import { CommandContext } from '../types';
import * as fflate from 'fflate';

export const pipCmd = async (ctx: CommandContext): Promise<number> => {
  const subCmd = ctx.args[0];
  if (!subCmd) {
    ctx.stderr('pip: missing command (try: pip install <pkg>)\\r\\n');
    return 1;
  }

  if (subCmd === 'install') {
    const pkg = ctx.args[1];
    if (!pkg) {
      ctx.stderr('pip: missing package name\\r\\n');
      return 1;
    }

    ctx.stdout(`\\x1b[36m[pip]\x1b[0m Resolving ${pkg} via PyPI...\\r\\n`);
    try {
      const res = await fetch(`https://pypi.org/pypi/${pkg}/json`);
      if (!res.ok) {
        ctx.stderr(`pip: failed to fetch package info (status ${res.status})\\r\\n`);
        return 1;
      }
      
      const data = await res.json();
      const releases = data.urls || [];
      // Find a pure python wheel
      const wheel = releases.find((r: any) => r.packagetype === 'bdist_wheel' && (r.python_version === 'source' || r.python_version === 'py3' || r.python_version === 'py2.py3' || r.filename.includes('none-any.whl')));
      
      if (!wheel) {
        ctx.stderr(`pip: no suitable pure python wheel found for ${pkg}\\r\\n`);
        return 1;
      }

      ctx.stdout(`\\x1b[36m[pip]\x1b[0m Downloading ${wheel.filename} (${Math.round(wheel.size / 1024)} KB)...\\r\\n`);
      
      const whlRes = await fetch(wheel.url);
      const whlBuf = await whlRes.arrayBuffer();
      const whlUint8 = new Uint8Array(whlBuf);

      ctx.stdout(`\\x1b[36m[pip]\x1b[0m Extracting into /lib/python3.12/site-packages...\\r\\n`);
      
      const sitePackages = '/lib/python3.12/site-packages';
      await ctx.vfs.mkdir(sitePackages, { recursive: true });

      // Unzip
      const unzipped = fflate.unzipSync(whlUint8);
      let fileCount = 0;
      
      for (const [filename, fileData] of Object.entries(unzipped)) {
        if (!filename.endsWith('/')) { // not a directory
          const fullPath = `${sitePackages}/${filename}`;
          const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
          await ctx.vfs.mkdir(dirPath, { recursive: true });
          await ctx.vfs.writeFile(fullPath, fileData);
          fileCount++;
        }
      }

      ctx.stdout(`\\x1b[32m[pip]\x1b[0m Successfully installed ${pkg} (${fileCount} files)\\r\\n`);
      return 0;
    } catch (e: any) {
      ctx.stderr(`pip error: ${e.message}\\r\\n`);
      return 1;
    }
  }

  ctx.stderr(`pip: unknown command '${subCmd}'\\r\\n`);
  return 1;
};
