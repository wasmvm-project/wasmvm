import { CommandContext } from '../types';

export const jsCmd = async (ctx: CommandContext): Promise<number> => {
  const targetScript = ctx.args[0];
  if (!targetScript) {
    ctx.stderr('js: please specify a script to run\r\n');
    return 1;
  }

  // Resolve absolute path
  let absPath = targetScript.startsWith('/') ? targetScript : `${ctx.env.get('PWD')}/${targetScript}`;
  absPath = absPath.replace(/\/+/g, '/'); // normalize

  if (!(await ctx.vfs.exists(absPath))) {
    ctx.stderr(`js: cannot access '${targetScript}': No such file or directory\r\n`);
    return 1;
  }

  // Find import_map.json
  const pwd = ctx.env.get('PWD') || '/home/user';
  const importMapPath = `${pwd}/import_map.json`.replace(/\/+/g, '/');
  let importMapStr = '';
  if (await ctx.vfs.exists(importMapPath)) {
    try {
      importMapStr = await ctx.vfs.readTextFile(importMapPath);
    } catch {}
  }

  // We will run the JS in an iframe to isolate it and support importmap natively.
    return new Promise<number>((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.sandbox.add('allow-scripts', 'allow-same-origin');

    const channelId = `js-cmd-${Date.now()}-${Math.random()}`;

    const messageListener = (e: MessageEvent) => {
      if (e.data?.channelId !== channelId) return;
      if (e.data.type === 'stdout') {
        ctx.stdout(e.data.text + '\r\n');
      } else if (e.data.type === 'stderr') {
        ctx.stderr(e.data.text + '\r\n');
      } else if (e.data.type === 'done') {
        cleanup();
        resolve(e.data.exitCode);
      }
    };

    window.addEventListener('message', messageListener);

    const cleanup = () => {
      window.removeEventListener('message', messageListener);
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };

    const opfsUrl = `/opfs${absPath}`;
    
    // When the iframe loads, post the initialization message
    iframe.onload = () => {
      iframe.contentWindow?.postMessage({
        type: 'init',
        channelId,
        scriptUrl: opfsUrl,
        importMapStr,
        argv: ['node', absPath, ...ctx.args.slice(1)]
      }, '*');
    };

    iframe.src = '/sandbox.html';
    document.body.appendChild(iframe);
  });
};
