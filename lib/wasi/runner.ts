import { WasiHost, WasiOptions } from './wasi-host';

export interface WasmRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export class WasmRunner {
  public static async run(
    wasmBytes: Uint8Array,
    options: WasiOptions = {}
  ): Promise<WasmRunResult> {
    let stdoutBuffer = '';
    let stderrBuffer = '';

    const decoder = new TextDecoder();
    const wasi = new WasiHost({
      ...options,
      stdout: (data) => {
        const text = decoder.decode(data);
        stdoutBuffer += text;
        options.stdout?.(data);
      },
      stderr: (data) => {
        const text = decoder.decode(data);
        stderrBuffer += text;
        options.stderr?.(data);
      },
    });

    const imports: WebAssembly.Imports = {
      wasi_snapshot_preview1: wasi.getImports() as any,
      env: {
        memory: new WebAssembly.Memory({ initial: 256, maximum: 2048 }),
      },
    };

    try {
      const module = await WebAssembly.compile(wasmBytes as any);
      const instance = await WebAssembly.instantiate(module, imports);

      if (instance.exports.memory) {
        wasi.setMemory(instance.exports.memory as WebAssembly.Memory);
      } else if (imports.env && (imports.env as any).memory) {
        wasi.setMemory((imports.env as any).memory);
      }

      // WASI entrypoint is typically _start
      if (typeof (instance.exports._start as Function) === 'function') {
        try {
          (instance.exports._start as Function)();
        } catch (e: any) {
          if (e.message && e.message.startsWith('WASI_EXIT_')) {
            // Normal exit
          } else {
            throw e;
          }
        }
      } else if (typeof (instance.exports.main as Function) === 'function') {
        (instance.exports.main as Function)();
      }

      return {
        exitCode: wasi.exitCode,
        stdout: stdoutBuffer,
        stderr: stderrBuffer,
      };
    } catch (e: any) {
      if (e.message && e.message.startsWith('WASI_EXIT_')) {
        return {
          exitCode: wasi.exitCode,
          stdout: stdoutBuffer,
          stderr: stderrBuffer,
        };
      }
      return {
        exitCode: 1,
        stdout: stdoutBuffer,
        stderr: stderrBuffer + (stderrBuffer ? '\r\n' : '') + `Runtime error: ${e.message}\r\n`,
      };
    }
  }
}
