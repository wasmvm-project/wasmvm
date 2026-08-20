export * from "https://esm.sh/node/url.mjs";
import { fileURLToPath as original } from "https://esm.sh/node/url.mjs";

export function fileURLToPath(url) {
  if (typeof url === 'string' && url.startsWith('http')) {
     return new URL(url).pathname;
  }
  if (url && url.protocol && url.protocol.startsWith('http')) {
     return url.pathname;
  }
  try {
     return original(url);
  } catch(e) {
     return typeof url === 'string' ? url : (url.pathname || String(url));
  }
}
