import { CommandContext } from '../types';
import { WpmManager } from '../../wpm/manager';
import { WPM_REGISTRY } from '../../wpm/registry';

export const wpmCmd = async (ctx: CommandContext): Promise<number> => {
  const subCmd = ctx.args[0] || 'help';
  const manager = new WpmManager(ctx.vfs);

  if (subCmd === 'update' || subCmd === 'refresh') {
    ctx.stdout('\x1b[90m[wpm] Synchronizing with https://github.com/wasmvm-project/wpm-registry ...\x1b[0m\r\n');
    try {
      const reg = await manager.fetchRemoteRegistry();
      const count = Object.keys(reg).length;
      ctx.stdout(`\x1b[32m[wpm] Registry synchronized successfully (${count} packages available from GitHub)\x1b[0m\r\n`);
      return 0;
    } catch (e: any) {
      ctx.stderr(`wpm update failed: ${e.message}\r\n`);
      return 1;
    }
  }

  if (subCmd === 'list') {
    const packages = await manager.listPackages();
    ctx.stdout('\r\n\x1b[1;36mAvailable WASM Packages (wpm remote registry):\x1b[0m\r\n');
    ctx.stdout('----------------------------------------------------------------------\r\n');
    ctx.stdout('Name          Version       Size     Status       Description\r\n');
    ctx.stdout('----------------------------------------------------------------------\r\n');

    for (const pkg of packages) {
      const status = pkg.installed
        ? '\x1b[32minstalled\x1b[0m'
        : '\x1b[90mnot installed\x1b[0m';
      const namePad = pkg.name.padEnd(13, ' ');
      const verPad = pkg.version.padEnd(13, ' ');
      const sizePad = (pkg.size || '-').padEnd(8, ' ');
      const statusPad = pkg.installed ? status + '  ' : status;
      ctx.stdout(`\x1b[1;33m${namePad}\x1b[0m ${verPad} ${sizePad} ${statusPad}  ${pkg.description}\r\n`);
    }
    ctx.stdout('\r\nRun \x1b[32mwpm install <package_name>\x1b[0m to install, \x1b[32mwpm update\x1b[0m to sync registry.\r\n');
    return 0;
  }

  if (subCmd === 'install' || subCmd === 'i' || subCmd === 'add' || subCmd === 'upgrade') {
    const targetPkg = ctx.args[1];
    if (!targetPkg) {
      ctx.stderr(`wpm: please specify a package name (e.g. wpm ${subCmd} cowsay)\r\n`);
      return 1;
    }
    const forceUpgrade = subCmd === 'upgrade';
    if (forceUpgrade) {
      ctx.stdout(`\x1b[33m[wpm] Forcing upgrade (bypassing cache)...\x1b[0m\r\n`);
    }

    try {
      await manager.install(targetPkg, (msg) => ctx.stdout(msg), forceUpgrade);
      return 0;
    } catch (e: any) {
      ctx.stderr(`wpm ${subCmd} failed: ${e.message}\r\n`);
      return 1;
    }
  }

  if (subCmd === 'remove' || subCmd === 'rm' || subCmd === 'uninstall') {
    const targetPkg = ctx.args[1];
    if (!targetPkg) {
      ctx.stderr('wpm: please specify a package name\r\n');
      return 1;
    }

    try {
      await manager.remove(targetPkg);
      ctx.stdout(`[wpm] Removed '${targetPkg}' successfully\r\n`);
      return 0;
    } catch (e: any) {
      ctx.stderr(`wpm remove failed: ${e.message}\r\n`);
      return 1;
    }
  }

  if (subCmd === 'info') {
    const targetPkg = ctx.args[1];
    const registry = await manager.fetchRemoteRegistry();
    if (!targetPkg || !registry[targetPkg]) {
      ctx.stderr(`wpm: package '${targetPkg || ''}' not found\r\n`);
      return 1;
    }

    const pkg = registry[targetPkg];
    const isInst = await manager.isInstalled(pkg.name);
    const infoText = `
\x1b[1;36mPackage:\x1b[0m     ${pkg.name}
\x1b[1;36mVersion:\x1b[0m     ${pkg.version}
\x1b[1;36mSize:\x1b[0m        ${pkg.size}
\x1b[1;36mCategory:\x1b[0m    ${pkg.category}
\x1b[1;36mAuthor:\x1b[0m      ${pkg.author || 'Unknown'}
\x1b[1;36mStatus:\x1b[0m      ${isInst ? '\x1b[32mInstalled\x1b[0m' : 'Not installed'}
\x1b[1;36mDescription:\x1b[0m ${pkg.description}
`;
    ctx.stdout(infoText.replace(/\n/g, '\r\n'));
    return 0;
  }

  // Help
  const helpText = `
\x1b[1;36mwpm (WASM Package Manager) - CLI Tool\x1b[0m

Usage:
  wpm list                 List all available and installed packages
  wpm update               Sync package catalog from GitHub registry
  wpm install <package>    Install a WASM package to /bin in OPFS
  wpm upgrade <package>    Force-upgrade a package (bypass cache)
  wpm remove <package>     Uninstall a package
  wpm info <package>       Show package metadata and details
  wpm help                 Show this help message
`;
  ctx.stdout(helpText.replace(/\n/g, '\r\n'));
  return 0;
};
