/**
 * WASI Preview 1 (wasi_snapshot_preview1) Host Implementation
 * Maps WASI system calls to memory, stdio, and VFS.
 */

export interface WasiOptions {
  args?: string[];
  env?: Record<string, string>;
  stdin?: Uint8Array | string;
  stdout?: (data: Uint8Array) => void;
  stderr?: (data: Uint8Array) => void;
  fs?: any;
}

// WASI Error Codes
export const WASI_ESUCCESS = 0;
export const WASI_EBADF = 8;
export const WASI_EINVAL = 28;
export const WASI_ENOSYS = 52;
export const WASI_ENOTDIR = 54;
export const WASI_ENOENT = 44;

export class WasiHost {
  private memory: WebAssembly.Memory | null = null;
  private args: string[];
  private env: Record<string, string>;
  private stdin: Uint8Array;
  private stdinOffset = 0;
  private stdoutCallback: (data: Uint8Array) => void;
  private stderrCallback: (data: Uint8Array) => void;
  public exitCode = 0;

  constructor(options: WasiOptions = {}) {
    this.args = options.args || ['wasm_exec'];
    this.env = options.env || { USER: 'user', PATH: '/bin' };
    this.stdin = typeof options.stdin === 'string'
      ? new TextEncoder().encode(options.stdin)
      : (options.stdin || new Uint8Array());
    this.stdoutCallback = options.stdout || (() => {});
    this.stderrCallback = options.stderr || (() => {});
  }

  public setMemory(memory: WebAssembly.Memory) {
    this.memory = memory;
  }

  private getView(): DataView {
    if (!this.memory) throw new Error('WASI memory not bound');
    return new DataView(this.memory.buffer);
  }

  private getUint8Array(): Uint8Array {
    if (!this.memory) throw new Error('WASI memory not bound');
    return new Uint8Array(this.memory.buffer);
  }

  public getImports(): Record<string, Function> {
    return {
      args_get: (argvPtr: number, argvBufPtr: number): number => {
        const view = this.getView();
        const mem = this.getUint8Array();
        const encoder = new TextEncoder();
        let currentBufPtr = argvBufPtr;

        for (let i = 0; i < this.args.length; i++) {
          view.setUint32(argvPtr + i * 4, currentBufPtr, true);
          const encoded = encoder.encode(this.args[i] + '\0');
          mem.set(encoded, currentBufPtr);
          currentBufPtr += encoded.length;
        }
        return WASI_ESUCCESS;
      },

      args_sizes_get: (argcPtr: number, argvBufSizePtr: number): number => {
        const view = this.getView();
        const encoder = new TextEncoder();
        let totalSize = 0;
        for (const arg of this.args) {
          totalSize += encoder.encode(arg + '\0').length;
        }
        view.setUint32(argcPtr, this.args.length, true);
        view.setUint32(argvBufSizePtr, totalSize, true);
        return WASI_ESUCCESS;
      },

      environ_get: (environPtr: number, environBufPtr: number): number => {
        const view = this.getView();
        const mem = this.getUint8Array();
        const encoder = new TextEncoder();
        const envEntries = Object.entries(this.env);
        let currentBufPtr = environBufPtr;

        for (let i = 0; i < envEntries.length; i++) {
          view.setUint32(environPtr + i * 4, currentBufPtr, true);
          const str = `${envEntries[i][0]}=${envEntries[i][1]}\0`;
          const encoded = encoder.encode(str);
          mem.set(encoded, currentBufPtr);
          currentBufPtr += encoded.length;
        }
        return WASI_ESUCCESS;
      },

      environ_sizes_get: (environCountPtr: number, environBufSizePtr: number): number => {
        const view = this.getView();
        const encoder = new TextEncoder();
        const envEntries = Object.entries(this.env);
        let totalSize = 0;
        for (const [k, v] of envEntries) {
          totalSize += encoder.encode(`${k}=${v}\0`).length;
        }
        view.setUint32(environCountPtr, envEntries.length, true);
        view.setUint32(environBufSizePtr, totalSize, true);
        return WASI_ESUCCESS;
      },

      clock_time_get: (id: number, precision: bigint, timePtr: number): number => {
        const view = this.getView();
        const nowNs = BigInt(Date.now()) * BigInt(1000000);
        view.setBigUint64(timePtr, nowNs, true);
        return WASI_ESUCCESS;
      },

      random_get: (bufPtr: number, bufLen: number): number => {
        const mem = this.getUint8Array();
        const slice = mem.subarray(bufPtr, bufPtr + bufLen);
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
          crypto.getRandomValues(slice);
        } else {
          for (let i = 0; i < bufLen; i++) {
            slice[i] = Math.floor(Math.random() * 256);
          }
        }
        return WASI_ESUCCESS;
      },

      fd_write: (fd: number, iovsPtr: number, iovsLen: number, nwrittenPtr: number): number => {
        const view = this.getView();
        const mem = this.getUint8Array();
        let totalWritten = 0;

        for (let i = 0; i < iovsLen; i++) {
          const ptr = view.getUint32(iovsPtr + i * 8, true);
          const len = view.getUint32(iovsPtr + i * 8 + 4, true);
          const chunk = mem.subarray(ptr, ptr + len);

          if (fd === 1) {
            this.stdoutCallback(chunk);
          } else if (fd === 2) {
            this.stderrCallback(chunk);
          }
          totalWritten += len;
        }

        view.setUint32(nwrittenPtr, totalWritten, true);
        return WASI_ESUCCESS;
      },

      fd_read: (fd: number, iovsPtr: number, iovsLen: number, nreadPtr: number): number => {
        if (fd !== 0) return WASI_EBADF;

        const view = this.getView();
        const mem = this.getUint8Array();
        let totalRead = 0;

        for (let i = 0; i < iovsLen; i++) {
          const ptr = view.getUint32(iovsPtr + i * 8, true);
          const len = view.getUint32(iovsPtr + i * 8 + 4, true);

          const available = this.stdin.length - this.stdinOffset;
          if (available <= 0) break;

          const toRead = Math.min(len, available);
          mem.set(this.stdin.subarray(this.stdinOffset, this.stdinOffset + toRead), ptr);
          this.stdinOffset += toRead;
          totalRead += toRead;
        }

        view.setUint32(nreadPtr, totalRead, true);
        return WASI_ESUCCESS;
      },

      fd_close: (fd: number): number => {
        return WASI_ESUCCESS;
      },

      fd_seek: (fd: number, offset: bigint, whence: number, newOffsetPtr: number): number => {
        return WASI_ESUCCESS;
      },

      fd_fdstat_get: (fd: number, statPtr: number): number => {
        const view = this.getView();
        // File type: character device for stdio (2)
        view.setUint8(statPtr, 2);
        view.setUint16(statPtr + 2, 0, true);
        view.setBigUint64(statPtr + 8, BigInt("0xffffffffffffffff"), true);
        view.setBigUint64(statPtr + 16, BigInt("0xffffffffffffffff"), true);
        return WASI_ESUCCESS;
      },

      fd_prestat_get: (fd: number, prestatPtr: number): number => {
        return WASI_EBADF;
      },

      fd_prestat_dir_name: (fd: number, pathPtr: number, pathLen: number): number => {
        return WASI_EBADF;
      },

      proc_exit: (rval: number): void => {
        this.exitCode = rval;
        throw new Error(`WASI_EXIT_${rval}`);
      },

      sched_yield: (): number => {
        return WASI_ESUCCESS;
      },
    };
  }
}
