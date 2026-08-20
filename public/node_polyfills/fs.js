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

const resolveUrl = (path) => {
  let url = typeof path === 'string' ? path : (path.toString ? path.toString() : String(path));
  if (url.startsWith('https:/') && !url.startsWith('https://')) {
     url = url.replace('https:/', 'https://');
  }
  if (!url.startsWith('http')) {
     if (url.match(/^\/([a-zA-Z0-9_-]+@\d+\.\d+\.\d+|v\d+\/|gh\/|npm\/|@[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+@\d+\.\d+\.\d+)/)) {
       return { url: `https://esm.sh${url}`, isNetwork: true };
     }
     return { url: `/opfs${url.startsWith('/') ? '' : '/'}${url}`, isNetwork: false, originalPath: url };
  }
  return { url, isNetwork: true };
};

export const readFileSync = (path, opts) => {
  const { url } = resolveUrl(path);
  const xhr = new XMLHttpRequest();
  xhr.open('GET', url, false);
  xhr.send(null);
  if (xhr.status === 200) {
    return xhr.responseText;
  }
  throw new Error(`ENOENT: no such file or directory, open '${path}'`);
};

export const existsSync = (path) => {
  const resolved = resolveUrl(path);
  if (resolved.isNetwork) {
    const xhr = new XMLHttpRequest();
    xhr.open('HEAD', resolved.url, false);
    xhr.send(null);
    return xhr.status === 200;
  }
  
  const xhr = new XMLHttpRequest();
  xhr.open('GET', `/__sync_fs__/exists?path=${encodeURIComponent(resolved.originalPath)}`, false);
  xhr.send(null);
  if (xhr.status === 200) {
    try {
      return JSON.parse(xhr.responseText).exists;
    } catch(e) {}
  }
  return false;
};

export const statSync = (path) => {
  const resolved = resolveUrl(path);
  if (resolved.isNetwork) {
    const xhr = new XMLHttpRequest();
    xhr.open('HEAD', resolved.url, false);
    xhr.send(null);
    if (xhr.status === 200) {
      return { isFile: () => true, isDirectory: () => false, size: 0 };
    }
    throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
  }

  const xhr = new XMLHttpRequest();
  xhr.open('GET', `/__sync_fs__/stat?path=${encodeURIComponent(resolved.originalPath)}`, false);
  xhr.send(null);
  if (xhr.status === 200) {
    try {
      const data = JSON.parse(xhr.responseText);
      if (data.exists) {
        return {
          isFile: () => data.isFile,
          isDirectory: () => data.isDirectory,
          size: 0,
        };
      }
    } catch(e) {}
  }
  throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
};

export const readdirSync = (path) => {
  const resolved = resolveUrl(path);
  if (resolved.isNetwork) {
    return []; // Cannot readdir network
  }

  const xhr = new XMLHttpRequest();
  xhr.open('GET', `/__sync_fs__/readdir?path=${encodeURIComponent(resolved.originalPath)}`, false);
  xhr.send(null);
  if (xhr.status === 200) {
    try {
      return JSON.parse(xhr.responseText);
    } catch(e) {}
  }
  throw new Error(`ENOENT: no such file or directory, scandir '${path}'`);
};

export const writeFileSync = (path, data, opts) => notSupported('writeFileSync');

export default {
  promises,
  readFile,
  writeFile,
  readFileSync,
  writeFileSync,
  existsSync,
  statSync
};
