import { CommandContext } from '../types';

let micropythonInstance: any = null;

async function getMicroPython(stdout: (t: string) => void, stderr: (t: string) => void) {
  if (!micropythonInstance) {
    let loadMicroPythonFn: any;

    if (typeof window !== 'undefined') {
      // Browser: load from CDN to avoid bundler Node 'fs' polyfill issues
      const mod = await (Function('return import("https://cdn.jsdelivr.net/npm/@micropython/micropython-webassembly-pyscript/micropython.mjs")')() as Promise<any>);
      loadMicroPythonFn = mod.loadMicroPython;
    } else {
      // Node.js test environment
      const mod = await import('@micropython/micropython-webassembly-pyscript');
      loadMicroPythonFn = mod.loadMicroPython;
    }

    micropythonInstance = await loadMicroPythonFn({
      stdout: (line: string) => {
        stdout(line + '\r\n');
      },
      stderr: (line: string) => {
        stderr(line + '\r\n');
      },
    });
  }
  return micropythonInstance;
}

export const pythonCmd = async (ctx: CommandContext): Promise<number> => {
  const args = ctx.args;

  try {
    ctx.stdout('\x1b[90m[Initializing MicroPython runtime...]\x1b[0m\r\n');
    const mp = await getMicroPython(ctx.stdout, ctx.stderr);

    // python -c "code"
    if (args[0] === '-c' && args[1]) {
      const code = args.slice(1).join(' ');
      try {
        mp.runPython(code);
        return 0;
      } catch (e: any) {
        ctx.stderr(`Python Error: ${e.message}\r\n`);
        return 1;
      }
    }

    // python script.py
    if (args.length > 0 && !args[0].startsWith('-')) {
      const scriptPath = args[0];
      try {
        const code = await ctx.vfs.readTextFile(scriptPath);
        mp.runPython(code);
        return 0;
      } catch (e: any) {
        ctx.stderr(`python: can't open file '${scriptPath}': ${e.message}\r\n`);
        return 1;
      }
    }

    // If stdin provided via pipe (e.g. echo "print(1+1)" | python)
    if (ctx.stdin) {
      try {
        mp.runPython(ctx.stdin);
        return 0;
      } catch (e: any) {
        ctx.stderr(`Python Error: ${e.message}\r\n`);
        return 1;
      }
    }

    // Interactive Demo / Banner
    ctx.stdout(`
\x1b[1;36mMicroPython v1.28.0 (WebAssembly WASI on wasmvm)\x1b[0m
Type \x1b[32mpython script.py\x1b[0m or \x1b[32mpython -c "code"\x1b[0m or use the REPL.

\x1b[1;33mQuick Test:\x1b[0m
`);
    mp.runPython('import sys; print("Python version:", sys.version)');
    mp.runPython('print("Math check: 2**10 =", 2**10, ", [x*2 for x in range(5)] =", [x*2 for x in range(5)])');
    ctx.stdout('\r\n\x1b[36mTip:\x1b[0m Create a Python file with \x1b[32mcode app.py\x1b[0m and run \x1b[32mpython app.py\x1b[0m\r\n\r\n');
    return 0;
  } catch (e: any) {
    ctx.stderr(`Failed to run Python: ${e.message}\r\n`);
    return 1;
  }
};
