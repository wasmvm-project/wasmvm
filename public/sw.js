const CACHE_NAME = 'wasmvm-pwa-v1';

const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/wasm/cowsay.wasm',
  '/wasm/figlet.wasm',
  '/wasm/jq.wasm',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache partial warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension/internal requests
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  // 0. OPFS Interception
  if (url.pathname.startsWith('/opfs/')) {
    event.respondWith((async () => {
      try {
        const root = await navigator.storage.getDirectory();
        const parts = decodeURIComponent(url.pathname).replace(/^\/opfs\//, '').split('/').filter(Boolean);
        let curr = root;
        for (let i = 0; i < parts.length - 1; i++) {
          curr = await curr.getDirectoryHandle(parts[i]);
        }
        const fileHandle = await curr.getFileHandle(parts[parts.length - 1]);
        const file = await fileHandle.getFile();
        
        let contentType = 'application/octet-stream';
        if (url.pathname.endsWith('.js') || url.pathname.endsWith('.mjs')) contentType = 'application/javascript';
        else if (url.pathname.endsWith('.json')) contentType = 'application/json';
        else if (url.pathname.endsWith('.css')) contentType = 'text/css';
        else if (url.pathname.endsWith('.html')) contentType = 'text/html';
        else if (url.pathname.endsWith('.py')) contentType = 'text/plain';
        
        return new Response(file, {
          headers: {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (e) {
        return new Response('Not found in OPFS: ' + e.message, { status: 404 });
      }
    })());
    return;
  }

  // 0.5. Node built-in module interception (from esm.sh bundles)
  if (url.pathname.startsWith('/node/')) {
    const moduleName = url.pathname.replace('/node/', '').replace('.mjs', '');
    if (moduleName === 'fs' || moduleName === 'fs.promises') {
      event.respondWith(
        fetch(new Request(`/node_polyfills/fs.js`, request))
      );
      return;
    }
    if (moduleName === 'child_process') {
      event.respondWith(
        fetch(new Request(`/node_polyfills/child_process.js`, request))
      );
      return;
    }
    if (moduleName === 'url') {
      event.respondWith(
        fetch(new Request(`/node_polyfills/url.js`, request))
      );
      return;
    }
    // Fallback other node builtins to esm.sh
    event.respondWith(
      fetch(new Request(`https://esm.sh/node/${moduleName}.mjs`))
    );
    return;
  }

  // 1. WASM binaries, static files, and CDN assets: Cache-First strategy
  if (
    url.pathname.endsWith('.wasm') ||
    url.pathname.includes('/_next/static/') ||
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => {
          // If offline and not in cache, fallback
          return cachedResponse || new Response('Offline resource unavailable', { status: 503 });
        });
      })
    );
    return;
  }

  // 2. Navigation / HTML requests: Network-First with Cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const rootCached = await caches.match('/');
        if (rootCached) return rootCached;
        return new Response('<h1>wasmvm (Offline)</h1><p>Please reload when connected.</p>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      })
    );
    return;
  }

  // 3. Default: Network with Cache fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request).then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
      );
    })
  );
});
