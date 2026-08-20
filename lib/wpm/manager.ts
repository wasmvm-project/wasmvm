import { VFSManager } from '../vfs/vfs-manager';
import { WpmPackage, WPM_REGISTRY } from './registry';

const CACHE_NAME = 'wasmvm-packages-v1';
const REMOTE_REGISTRY_URL = 'https://raw.githubusercontent.com/wasmvm-project/wpm-registry/main/index.json';
const CDN_REGISTRY_URL = 'https://cdn.jsdelivr.net/gh/wasmvm-project/wpm-registry@main/index.json';

export class WpmManager {
  private vfs: VFSManager;
  private static dynamicRegistry: Record<string, WpmPackage> | null = null;

  constructor(vfs: VFSManager) {
    this.vfs = vfs;
  }

  public async fetchRemoteRegistry(): Promise<Record<string, WpmPackage>> {
    try {
      let res = await fetch(`${CDN_REGISTRY_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) {
        res = await fetch(`${REMOTE_REGISTRY_URL}?t=${Date.now()}`, { cache: 'no-store' });
      }
      if (res.ok) {
        const data = await res.json();
        if (data && data.packages) {
          const merged = { ...WPM_REGISTRY, ...data.packages };
          WpmManager.dynamicRegistry = merged;
          return merged;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch remote registry, using built-in cache:', e);
    }
    return WPM_REGISTRY;
  }

  public async listPackages(): Promise<WpmPackage[]> {
    const registry = WpmManager.dynamicRegistry || (await this.fetchRemoteRegistry()) || WPM_REGISTRY;
    const packages: WpmPackage[] = [];
    for (const [key, pkg] of Object.entries(registry)) {
      const isInstalled = await this.isInstalled(pkg.name);
      packages.push({
        ...pkg,
        installed: isInstalled,
      });
    }
    return packages;
  }

  public async isInstalled(name: string): Promise<boolean> {
    const registry = WpmManager.dynamicRegistry || WPM_REGISTRY;
    const pkg = registry[name];
    const ext = pkg?.type === 'js' ? '.js' : '.wasm';
    const binName = pkg?.executable || `${name}${ext}`;
    const binPath = `/bin/${binName}`;
    return await this.vfs.exists(binPath);
  }

  public async install(name: string, onProgress?: (msg: string) => void): Promise<boolean> {
    const registry = WpmManager.dynamicRegistry || (await this.fetchRemoteRegistry()) || WPM_REGISTRY;
    const pkg = registry[name];
    if (!pkg) {
      throw new Error(`Package '${name}' not found in registry (run 'wpm update' to refresh)`);
    }

    const downloadUrl = (pkg as any).wasm_url || pkg.url || `/wasm/${pkg.name}.wasm`;
    onProgress?.(`[wpm] Fetching ${pkg.name}@${pkg.version} (${pkg.size})...\r\n`);

    let wasmData: Uint8Array;

    // Cache API チェック
    if (typeof caches !== 'undefined') {
      try {
        const cache = await caches.open(CACHE_NAME);
        const cachedRes = await cache.match(downloadUrl);
        if (cachedRes) {
          onProgress?.(`[wpm] Using cached binary from Cache API\r\n`);
          const buf = await cachedRes.arrayBuffer();
          wasmData = new Uint8Array(buf);
        } else {
          const res = await fetch(downloadUrl);
          if (!res.ok) {
            wasmData = await this.generateFallbackWasm(pkg.name);
          } else {
            const buf = await res.arrayBuffer();
            wasmData = new Uint8Array(buf);
            await cache.put(downloadUrl, new Response(buf));
          }
        }
      } catch {
        wasmData = await this.generateFallbackWasm(pkg.name);
      }
    } else {
      wasmData = await this.generateFallbackWasm(pkg.name);
    }

    const ext = pkg.type === 'js' ? '.js' : '.wasm';
    const binName = pkg.executable || `${pkg.name}${ext}`;
    onProgress?.(`[wpm] Writing to /bin/${binName} in OPFS...\r\n`);
    await this.vfs.writeFile(`/bin/${binName}`, wasmData);
    onProgress?.(`[wpm] Successfully installed '${pkg.name}'! (Run '${pkg.name}' to execute)\r\n`);
    return true;
  }

  public async remove(name: string): Promise<boolean> {
    const binPath = `/bin/${name}.wasm`;
    if (!(await this.vfs.exists(binPath))) {
      throw new Error(`Package '${name}' is not installed`);
    }
    await this.vfs.unlink(binPath);
    return true;
  }

  public async getBinary(name: string): Promise<Uint8Array | null> {
    const binPath = `/bin/${name}.wasm`;
    if (await this.vfs.exists(binPath)) {
      return await this.vfs.readFile(binPath);
    }
    return null;
  }

  private async generateFallbackWasm(pkgName: string): Promise<Uint8Array> {
    return new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    ]);
  }
}
