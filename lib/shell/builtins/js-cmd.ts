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

    // Create a unique message channel to communicate with this specific iframe
    const channelId = `js-cmd-${Date.now()}-${Math.random()}`;

    const messageListener = (e: MessageEvent) => {
      if (e.data?.channelId !== channelId) return;
      if (e.data.type === 'stdout') {
        ctx.stdout(e.data.text + '\\r\\n');
      } else if (e.data.type === 'stderr') {
        ctx.stderr(e.data.text + '\\r\\n');
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

    // Construct the HTML for the iframe
    const opfsUrl = `/opfs${absPath}`;
    const importMapTag = importMapStr ? `<script type="importmap">${importMapStr}</script>` : '';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        ${importMapTag}
      </head>
      <body>
        <script>
          // Override console
          ['log', 'info', 'warn', 'error', 'debug'].forEach(method => {
            const orig = console[method];
            console[method] = (...args) => {
              orig.apply(console, args);
              const text = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
              const type = (method === 'error' || method === 'warn') ? 'stderr' : 'stdout';
              window.parent.postMessage({ channelId: '${channelId}', type, text }, '*');
            };
          });

          // Unhandled errors
          window.addEventListener('error', (e) => {
            window.parent.postMessage({ channelId: '${channelId}', type: 'stderr', text: e.message }, '*');
            window.parent.postMessage({ channelId: '${channelId}', type: 'done', exitCode: 1 }, '*');
          });

          // Unhandled rejections
          window.addEventListener('unhandledrejection', (e) => {
            window.parent.postMessage({ channelId: '${channelId}', type: 'stderr', text: e.reason }, '*');
            window.parent.postMessage({ channelId: '${channelId}', type: 'done', exitCode: 1 }, '*');
          });
        </script>
        
        <script type="module">
          try {
            await import('${opfsUrl}');
            // Send done message after microtasks (if any synchronous or top-level await is done)
            // Note: If script has long running intervals, they will still run in background until iframe is removed.
            // We give it a small tick to flush logs before closing, but wait, if it's a server/long-running script,
            // we should not close the iframe! For now, we will close it after top-level execution.
            setTimeout(() => {
              window.parent.postMessage({ channelId: '${channelId}', type: 'done', exitCode: 0 }, '*');
            }, 100);
          } catch (e) {
            console.error(e);
            window.parent.postMessage({ channelId: '${channelId}', type: 'done', exitCode: 1 }, '*');
          }
        </script>
      </body>
      </html>
    `;

    document.body.appendChild(iframe);
    iframe.contentWindow?.document.open();
    iframe.contentWindow?.document.write(htmlContent);
    iframe.contentWindow?.document.close();

    // User interruption (Ctrl+C handling could be added here by listening to some event from Shell,
    // but for now, we just rely on it returning)
  });
};
