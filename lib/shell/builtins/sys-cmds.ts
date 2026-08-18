import { CommandContext } from '../types';

export const clearCmd = async (ctx: CommandContext): Promise<number> => {
  // Clear screen and reset cursor
  ctx.stdout('\x1b[2J\x1b[3J\x1b[H');
  return 0;
};

export const envCmd = async (ctx: CommandContext): Promise<number> => {
  const envMap = ctx.env;
  for (const [k, v] of envMap.entries()) {
    ctx.stdout(`${k}=${v}\r\n`);
  }
  return 0;
};

export const exportCmd = async (ctx: CommandContext): Promise<number> => {
  if (ctx.args.length === 0) {
    return envCmd(ctx);
  }

  for (const arg of ctx.args) {
    const eqIdx = arg.indexOf('=');
    if (eqIdx !== -1) {
      const key = arg.slice(0, eqIdx);
      const val = arg.slice(eqIdx + 1);
      ctx.env.set(key, val);
    }
  }
  return 0;
};

export const unameCmd = async (ctx: CommandContext): Promise<number> => {
  const all = ctx.args.includes('-a');
  if (all) {
    ctx.stdout('wasmvm 1.0.0 WASI/OPFS Browser POSIX Environment wasm32\r\n');
  } else {
    ctx.stdout('wasmvm\r\n');
  }
  return 0;
};

export const dateCmd = async (ctx: CommandContext): Promise<number> => {
  ctx.stdout(new Date().toString() + '\r\n');
  return 0;
};

export const helpCmd = async (ctx: CommandContext): Promise<number> => {
  const helpText = `
\x1b[1;36m======================================================================\x1b[0m
\x1b[1;32m  wasmvm - Modern WebAssembly & OPFS Browser Shell\x1b[0m
\x1b[1;36m======================================================================\x1b[0m

\x1b[1;33m[Built-in Commands (0ms latency)]\x1b[0m
  \x1b[32mls\x1b[0m [-lah] [path]        List directory contents
  \x1b[32mcd\x1b[0m [path]               Change working directory
  \x1b[32mpwd\x1b[0m                     Print current working directory
  \x1b[32mcat\x1b[0m [files...]          Concatenate and print files
  \x1b[32mtouch\x1b[0m [files...]        Create empty files
  \x1b[32mmkdir\x1b[0m [-p] [dirs...]    Create directories
  \x1b[32mrm\x1b[0m [-rf] [files...]     Remove files or directories
  \x1b[32mcp\x1b[0m <src> <dest>         Copy file
  \x1b[32mmv\x1b[0m <src> <dest>         Move / rename file
  \x1b[32mecho\x1b[0m [-n] [text...]      Print text with env variables
  \x1b[32mgrep\x1b[0m [-inv] <pattern>    Search pattern in files or stdin
  \x1b[32mhead\x1b[0m [-n N] [file]       Output first lines
  \x1b[32mtail\x1b[0m [-n N] [file]       Output last lines
  \x1b[32mwc\x1b[0m [-lwc] [file]        Count lines, words, bytes
  \x1b[32mclear\x1b[0m                   Clear the terminal screen
  \x1b[32menv\x1b[0m / \x1b[32mexport\x1b[0m [K=V]      Manage environment variables
  \x1b[32muname\x1b[0m [-a]              Print system information
  \x1b[32mdate\x1b[0m                    Print current date and time
  \x1b[32mcurl\x1b[0m [-o file] <url>    Fetch web content / API
  \x1b[32mnano\x1b[0m <file>             Simple text editor
  \x1b[32mhelp\x1b[0m                    Show this help message

\x1b[1;33m[WASM Package Manager (wpm)]\x1b[0m
  \x1b[32mwpm list\x1b[0m                List available & installed WASM packages
  \x1b[32mwpm install <pkg>\x1b[0m       Install a WASM package to /bin
  \x1b[32mwpm remove <pkg>\x1b[0m        Remove a WASM package
  \x1b[32mwpm info <pkg>\x1b[0m          Show package metadata

\x1b[1;33m[Shell Features]\x1b[0m
  • Pipelines:       \x1b[35mcat welcome.txt | grep wasmvm\x1b[0m
  • Redirection:     \x1b[35mecho "hi" > memo.txt\x1b[0m , \x1b[35mcat >> memo.txt\x1b[0m
  • Tab Completion:  Press \x1b[33m[Tab]\x1b[0m for command and path autocomplete
  • History:         Press \x1b[33m[↑ / ↓]\x1b[0m to navigate command history
  • Storage:         Native \x1b[32mOPFS (Origin Private File System)\x1b[0m
`;
  ctx.stdout(helpText.replace(/\n/g, '\r\n'));
  return 0;
};

export const curlCmd = async (ctx: CommandContext): Promise<number> => {
  let outFile: string | null = null;
  let url: string | null = null;

  for (let i = 0; i < ctx.args.length; i++) {
    const arg = ctx.args[i];
    if (arg === '-o' && ctx.args[i + 1]) {
      outFile = ctx.args[i + 1];
      i++;
    } else if (!url) {
      url = arg;
    }
  }

  if (!url) {
    ctx.stderr('curl: try \'curl --help\' or \'curl <url>\'\r\n');
    return 1;
  }

  try {
    ctx.stdout(`Fetching ${url}...\r\n`);
    const res = await fetch(url);
    if (!res.ok) {
      ctx.stderr(`curl: HTTP error ${res.status}: ${res.statusText}\r\n`);
      return 1;
    }

    if (outFile) {
      const buffer = await res.arrayBuffer();
      await ctx.vfs.writeFile(outFile, new Uint8Array(buffer));
      ctx.stdout(`Saved to ${outFile} (${buffer.byteLength} bytes)\r\n`);
    } else {
      const text = await res.text();
      ctx.stdout(text.replace(/\n/g, '\r\n') + '\r\n');
    }
    return 0;
  } catch (e: any) {
    ctx.stderr(`curl: (6) Could not resolve host or network error: ${e.message}\r\n`);
    return 1;
  }
};
