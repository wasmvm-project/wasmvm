const notSupported = (name) => {
  throw new Error(`[fs polyfill] ${name} is not supported in the browser environment (OPFS is async only)`);
};

export const promises = {
  readFile: async (path, options) => {
    const root = await navigator.storage.getDirectory();
    const parts = String(path).replace(/^\/+/, '').split('/').filter(Boolean);
    let curr = root;
    for (let i = 0; i < parts.length - 1; i++) {
      curr = await curr.getDirectoryHandle(parts[i]);
    }
    const fileHandle = await curr.getFileHandle(parts[parts.length - 1]);
    const file = await fileHandle.getFile();
    if (options === 'utf8' || options?.encoding === 'utf8') {
      return await file.text();
    }
    const arrayBuffer = await file.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  },
  writeFile: async (path, data, options) => {
    const root = await navigator.storage.getDirectory();
    const parts = String(path).replace(/^\/+/, '').split('/').filter(Boolean);
    let curr = root;
    for (let i = 0; i < parts.length - 1; i++) {
      curr = await curr.getDirectoryHandle(parts[i], { create: true });
    }
    const fileHandle = await curr.getFileHandle(parts[parts.length - 1], { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
  },
  mkdir: async (path, options) => {
    const root = await navigator.storage.getDirectory();
    const parts = String(path).replace(/^\/+/, '').split('/').filter(Boolean);
    let curr = root;
    for (const part of parts) {
      curr = await curr.getDirectoryHandle(part, { create: true });
    }
  },
  readdir: async (path) => {
    const root = await navigator.storage.getDirectory();
    const parts = String(path).replace(/^\/+/, '').split('/').filter(Boolean);
    let curr = root;
    for (const part of parts) {
      curr = await curr.getDirectoryHandle(part);
    }
    const entries = [];
    for await (const [name] of curr.entries()) {
      entries.push(name);
    }
    return entries;
  },
  stat: async (path) => {
    const root = await navigator.storage.getDirectory();
    const parts = String(path).replace(/^\/+/, '').split('/').filter(Boolean);
    let curr = root;
    for (let i = 0; i < parts.length - 1; i++) {
      curr = await curr.getDirectoryHandle(parts[i]);
    }
    const handle = await curr.getFileHandle(parts[parts.length - 1]).catch(() => curr.getDirectoryHandle(parts[parts.length - 1]));
    if (handle.kind === 'file') {
      const file = await handle.getFile();
      return {
        isFile: () => true,
        isDirectory: () => false,
        size: file.size,
        mtimeMs: file.lastModified
      };
    } else {
      return {
        isFile: () => false,
        isDirectory: () => true,
        size: 0,
        mtimeMs: Date.now()
      };
    }
  },
  unlink: async (path) => {
    const root = await navigator.storage.getDirectory();
    const parts = String(path).replace(/^\/+/, '').split('/').filter(Boolean);
    let curr = root;
    for (let i = 0; i < parts.length - 1; i++) {
      curr = await curr.getDirectoryHandle(parts[i]);
    }
    await curr.removeEntry(parts[parts.length - 1]);
  }
};

export const readFile = (path, opts, cb) => {
  const callback = typeof opts === 'function' ? opts : cb;
  promises.readFile(path, opts).then(data => callback(null, data)).catch(callback);
};

export const writeFile = (path, data, opts, cb) => {
  const callback = typeof opts === 'function' ? opts : cb;
  promises.writeFile(path, data, opts).then(() => callback(null)).catch(callback);
};

export const readFileSync = (path, opts) => notSupported('readFileSync');
export const writeFileSync = (path, data, opts) => notSupported('writeFileSync');
export const existsSync = (path) => notSupported('existsSync');
export const statSync = (path) => notSupported('statSync');

export default {
  promises,
  readFile,
  writeFile,
  readFileSync,
  writeFileSync,
  existsSync,
  statSync
};
