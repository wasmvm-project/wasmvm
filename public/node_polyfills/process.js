const p = window.process || {};
export const env = p.env || {};
export const argv = p.argv || [];
export const cwd = () => '/home/user';
export const exit = (code) => {
  if (p.exit) p.exit(code);
};
export const nextTick = (cb, ...args) => Promise.resolve().then(() => cb(...args));
export const platform = 'linux';
export const version = 'v18.0.0';
export const stderr = { write: (msg) => { console.error(msg); return true; } };
export const stdout = { write: (msg) => { console.log(msg); return true; } };
export default { env, argv, cwd, exit, nextTick, platform, version, stderr, stdout };
