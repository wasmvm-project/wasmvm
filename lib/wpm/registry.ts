export interface WpmPackage {
  name: string;
  version: string;
  description: string;
  category: 'utilities' | 'programming' | 'system' | 'games' | 'database';
  size: string;
  url: string;
  author?: string;
  installed?: boolean;
}

export const WPM_REGISTRY: Record<string, WpmPackage> = {
  python: {
    name: 'python',
    version: '3.12-wasm',
    description: 'Python interpreter compiled for WebAssembly & WASI (REPL & scripts)',
    category: 'programming',
    size: '1.8 MB',
    url: '/wasm/python.wasm',
    author: 'Python Software Foundation',
  },
  sqlite3: {
    name: 'sqlite3',
    version: '3.45.1',
    description: 'Embedded SQL database engine with CLI interface',
    category: 'database',
    size: '850 KB',
    url: '/wasm/sqlite3.wasm',
    author: 'D. Richard Hipp',
  },
  quickjs: {
    name: 'quickjs',
    version: '2024-01-13',
    description: 'Small and embeddable Javascript engine (ES2020) for WASI',
    category: 'programming',
    size: '720 KB',
    url: '/wasm/quickjs.wasm',
    author: 'Fabrice Bellard',
  },
  lua: {
    name: 'lua',
    version: '5.4.6',
    description: 'Powerful, efficient, lightweight, embeddable scripting language',
    category: 'programming',
    size: '310 KB',
    url: '/wasm/lua.wasm',
    author: 'Lua.org',
  },
  tcc: {
    name: 'tcc',
    version: '0.9.27',
    description: 'Tiny C Compiler: Compile and run C code directly in the browser',
    category: 'programming',
    size: '450 KB',
    url: '/wasm/tcc.wasm',
    author: 'Fabrice Bellard',
  },
  jq: {
    name: 'jq',
    version: '1.7',
    description: 'Command-line JSON processor',
    category: 'utilities',
    size: '480 KB',
    url: '/wasm/jq.wasm',
    author: 'Stephen Dolan',
  },
  cowsay: {
    name: 'cowsay',
    version: '1.0.0',
    description: 'Configurable talking cow in ASCII art (WASI binary)',
    category: 'games',
    size: '42 KB',
    url: '/wasm/cowsay.wasm',
    author: 'Tony Monroe',
  },
  figlet: {
    name: 'figlet',
    version: '2.2.5',
    description: 'Program for making large letters out of ordinary text',
    category: 'utilities',
    size: '120 KB',
    url: '/wasm/figlet.wasm',
    author: 'Glenn Chappell',
  },
};
