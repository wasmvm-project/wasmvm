import { CommandContext } from '../types';

export const mountLocalCmd = async (ctx: CommandContext): Promise<number> => {
  if (typeof window === 'undefined' || !(window as any).showDirectoryPicker) {
    ctx.stderr('mount-local: File System Access API is not supported in this browser (Use Chrome/Edge)\r\n');
    return 1;
  }

  try {
    ctx.stdout('Please select a local folder from your computer in the prompt...\r\n');
    const dirHandle = await (window as any).showDirectoryPicker();
    const folderName = dirHandle.name;
    const mountPath = `/mnt/${folderName}`;

    await ctx.vfs.mkdir(mountPath, { recursive: true });

    // Sync entries to OPFS mount folder
    ctx.stdout(`Mounting local folder '${folderName}' to ${mountPath}...\r\n`);
    let fileCount = 0;

    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind === 'file') {
        const file = await handle.getFile();
        const buf = await file.arrayBuffer();
        await ctx.vfs.writeFile(`${mountPath}/${name}`, new Uint8Array(buf));
        fileCount++;
      }
    }

    ctx.stdout(`\x1b[32mSuccessfully mounted '${folderName}' (${fileCount} files) to ${mountPath}\x1b[0m\r\n`);
    ctx.stdout(`Run \x1b[33mcd ${mountPath}\x1b[0m to explore your local files!\r\n`);
    return 0;
  } catch (e: any) {
    if (e.name === 'AbortError') {
      ctx.stderr('mount-local: operation aborted by user\r\n');
    } else {
      ctx.stderr(`mount-local: error: ${e.message}\r\n`);
    }
    return 1;
  }
};
