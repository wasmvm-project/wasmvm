import { VFSManager } from '../vfs/vfs-manager';
import { HistoryManager } from './history';
import { CompletionManager } from './completion';
import { ShellParser } from './parser';
import { BUILTIN_COMMANDS, executeBuiltin, isBuiltinCommand, getBuiltinNames } from './builtins';
import { CommandContext, ParsedPipeline, ParsedSingleCommand } from './types';
import { WasmRunner } from '../wasi/runner';
import { jsCmd } from './builtins/js-cmd';
import { AliasManager } from './alias';
import { GlobMatcher } from './glob';

export class Shell {
  private vfs: VFSManager;
  private history: HistoryManager;
  private completion: CompletionManager;
  private writeCallback: (text: string) => void;
  private currentInput: string = '';
  private cursorPosition: number = 0;
  private isExecuting: boolean = false;

  constructor(writeCallback: (text: string) => void) {
    this.vfs = VFSManager.getInstance();
    this.history = new HistoryManager();
    this.completion = new CompletionManager(this.vfs, getBuiltinNames());
    this.writeCallback = writeCallback;
  }

  public async init(): Promise<void> {
    const { isOPFS } = await this.vfs.init();
    this.updateCompletionBuiltins();

    // Source .bashrc if present
    const bashrcPath = '/home/user/.bashrc';
    if (await this.vfs.exists(bashrcPath)) {
      try {
        const content = await this.vfs.readTextFile(bashrcPath);
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          await this.executeCommandLine(trimmed, true);
        }
      } catch (e) {
        console.warn('Failed to auto-source .bashrc:', e);
      }
    }
  }

  public updateCompletionBuiltins(): void {
    const names = [...getBuiltinNames(), 'wpm'];
    this.completion.setBuiltinNames(names);
  }

  public getPrompt(): string {
    const user = (this.vfs.getEnv('USER') as string) || 'user';
    const cwd = this.vfs.getCwd();
    const home = (this.vfs.getEnv('HOME') as string) || '/home/user';
    const displayPath = cwd.startsWith(home) ? '~' + cwd.slice(home.length) : cwd;

    // ANSI Color prompt: green username, blue path, bold $
    return `\x1b[1;32m${user}@wasmvm\x1b[0m:\x1b[1;34m${displayPath}\x1b[0m$ `;
  }

  public writePrompt(): void {
    this.writeCallback(this.getPrompt());
    this.currentInput = '';
    this.cursorPosition = 0;
  }

  public async handleKeyInput(data: string): Promise<void> {
    if (this.isExecuting) return;

    // Enter
    if (data === '\r' || data === '\n') {
      this.writeCallback('\r\n');
      const cmd = this.currentInput;
      this.currentInput = '';
      this.cursorPosition = 0;

      if (cmd.trim().length > 0) {
        this.history.push(cmd);
        this.isExecuting = true;
        try {
          await this.executeCommandLine(cmd);
        } catch (e: any) {
          this.writeCallback(`\x1b[31mError: ${e.message}\x1b[0m\r\n`);
        } finally {
          this.isExecuting = false;
        }
      }
      this.writePrompt();
      return;
    }

    // Backspace (\x7F or \b)
    if (data === '\x7F' || data === '\b') {
      if (this.cursorPosition > 0) {
        const left = this.currentInput.slice(0, this.cursorPosition - 1);
        const right = this.currentInput.slice(this.cursorPosition);
        this.currentInput = left + right;
        this.cursorPosition--;
        this.redrawCurrentLine();
      }
      return;
    }

    // Arrow Up (\x1b[A)
    if (data === '\x1b[A') {
      const prev = this.history.getPrevious(this.currentInput);
      if (prev !== null) {
        this.currentInput = prev;
        this.cursorPosition = prev.length;
        this.redrawCurrentLine();
      }
      return;
    }

    // Arrow Down (\x1b[B)
    if (data === '\x1b[B') {
      const next = this.history.getNext();
      if (next !== null) {
        this.currentInput = next;
        this.cursorPosition = next.length;
        this.redrawCurrentLine();
      }
      return;
    }

    // Arrow Left (\x1b[D)
    if (data === '\x1b[D') {
      if (this.cursorPosition > 0) {
        this.cursorPosition--;
        this.writeCallback('\x1b[D');
      }
      return;
    }

    // Arrow Right (\x1b[C)
    if (data === '\x1b[C') {
      if (this.cursorPosition < this.currentInput.length) {
        this.cursorPosition++;
        this.writeCallback('\x1b[C');
      }
      return;
    }

    // Tab key (\t)
    if (data === '\t') {
      const res = await this.completion.complete(this.currentInput);
      if (res.candidates.length > 1) {
        this.writeCallback('\r\n' + res.candidates.join('  ') + '\r\n');
        this.currentInput = res.completed;
        this.cursorPosition = res.completed.length;
        this.writePrompt();
        this.writeCallback(this.currentInput);
      } else if (res.completed !== this.currentInput) {
        this.currentInput = res.completed;
        this.cursorPosition = res.completed.length;
        this.redrawCurrentLine();
      }
      return;
    }

    // Ctrl+C (\x03)
    if (data === '\x03') {
      this.writeCallback('^C\r\n');
      this.currentInput = '';
      this.cursorPosition = 0;
      this.writePrompt();
      return;
    }

    // Ctrl+L (\x0c) - Clear Screen
    if (data === '\x0c') {
      this.writeCallback('\x1b[2J\x1b[3J\x1b[H');
      this.writePrompt();
      this.writeCallback(this.currentInput);
      return;
    }

    // Ctrl+U (\x15) - Delete line before cursor
    if (data === '\x15') {
      this.currentInput = this.currentInput.slice(this.cursorPosition);
      this.cursorPosition = 0;
      this.redrawCurrentLine();
      return;
    }

    // Normal typing
    if (data.length === 1 && data >= ' ') {
      const left = this.currentInput.slice(0, this.cursorPosition);
      const right = this.currentInput.slice(this.cursorPosition);
      this.currentInput = left + data + right;
      this.cursorPosition++;
      this.redrawCurrentLine();
    }
  }

  private redrawCurrentLine(): void {
    this.writeCallback('\r\x1b[K');
    this.writeCallback(this.getPrompt() + this.currentInput);
    const offsetFromEnd = this.currentInput.length - this.cursorPosition;
    if (offsetFromEnd > 0) {
      this.writeCallback(`\x1b[${offsetFromEnd}D`);
    }
  }

  /**
   * コマンド置換 ($(cmd) or `cmd`) の展開
   */
  private async expandCommandSubstitution(input: string): Promise<string> {
    let result = input;

    // Expand $(cmd)
    const dollarParenRegex = /\$\(([^)]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = dollarParenRegex.exec(result)) !== null) {
      const subCmd = match[1];
      let subOutput = '';
      const subShell = new Shell((text) => {
        subOutput += text;
      });
      await subShell.executeCommandLine(subCmd, false);
      const cleanOutput = subOutput.replace(/\r?\n/g, ' ').trim();
      result = result.replace(match[0], cleanOutput);
    }

    // Expand `cmd`
    const backtickRegex = /`([^`]+)`/g;
    while ((match = backtickRegex.exec(result)) !== null) {
      const subCmd = match[1];
      let subOutput = '';
      const subShell = new Shell((text) => {
        subOutput += text;
      });
      await subShell.executeCommandLine(subCmd, false);
      const cleanOutput = subOutput.replace(/\r?\n/g, ' ').trim();
      result = result.replace(match[0], cleanOutput);
    }

    return result;
  }

  public async executeCommandLine(line: string, silent = false): Promise<number> {
    const expandedSubs = await this.expandCommandSubstitution(line);
    const envMap = this.vfs.getEnv() as Map<string, string>;
    const statement = ShellParser.parse(expandedSubs, envMap);

    let lastExitCode = 0;

    for (let i = 0; i < statement.pipelines.length; i++) {
      const item = statement.pipelines[i];
      const shouldRun =
        item.op === null ||
        item.op === ';' ||
        (item.op === '&&' && lastExitCode === 0) ||
        (item.op === '||' && lastExitCode !== 0);

      if (shouldRun) {
        lastExitCode = await this.executePipeline(item.pipeline, silent);
      }
    }

    return lastExitCode;
  }

  private async executePipeline(pipeline: ParsedPipeline, silent = false): Promise<number> {
    let pipelineStdin = '';

    for (let i = 0; i < pipeline.commands.length; i++) {
      const cmd = pipeline.commands[i];
      const isLast = i === pipeline.commands.length - 1;
      let cmdStdoutBuffer = '';

      // Check for alias expansion
      let cmdName = cmd.name;
      let cmdArgs = [...cmd.args];

      const aliasMgr = AliasManager.getInstance();
      const aliasExpanded = aliasMgr.expand(cmdName);
      if (aliasExpanded && aliasExpanded.length > 0) {
        cmdName = aliasExpanded[0];
        cmdArgs = [...aliasExpanded.slice(1), ...cmdArgs];
      }

      // Glob expansion for args (*.txt, etc.)
      cmdArgs = await GlobMatcher.expandArgs(cmdArgs, this.vfs);

      // Handle input redirection (< file)
      let currentStdin = pipelineStdin;
      if (cmd.redirectIn) {
        try {
          currentStdin = await this.vfs.readTextFile(cmd.redirectIn.file);
        } catch {
          if (!silent) {
            this.writeCallback(`\x1b[31m${cmd.redirectIn.file}: No such file or directory\x1b[0m\r\n`);
          }
          return 1;
        }
      }

      const stdoutHandler = (text: string) => {
        if (isLast && !cmd.redirectOut) {
          if (!silent) this.writeCallback(text);
          else cmdStdoutBuffer += text;
        } else {
          cmdStdoutBuffer += text;
        }
      };

      const stderrHandler = (text: string) => {
        if (!silent) this.writeCallback(`\x1b[31m${text}\x1b[0m`);
      };

      const ctx: CommandContext = {
        args: cmdArgs,
        stdin: currentStdin,
        stdout: stdoutHandler,
        stderr: stderrHandler,
        vfs: this.vfs,
        env: this.vfs.getEnv() as Map<string, string>,
      };

      let exitCode = 0;

      if (isBuiltinCommand(cmdName)) {
        exitCode = await executeBuiltin(cmdName, ctx);
      } else {
        // Try to execute from /bin/<cmdName>.wasm
        exitCode = await this.executeWasmCommand(cmdName, ctx);
      }

      if (exitCode !== 0 && !isLast) {
        return exitCode;
      }

      // Handle output redirection (> or >> file)
      if (cmd.redirectOut) {
        try {
          await this.vfs.writeFile(cmd.redirectOut.file, cmdStdoutBuffer, {
            append: cmd.redirectOut.append,
          });
        } catch (e: any) {
          if (!silent) {
            this.writeCallback(`\x1b[31mFailed to write '${cmd.redirectOut.file}': ${e.message}\x1b[0m\r\n`);
          }
          return 1;
        }
      } else {
        pipelineStdin = cmdStdoutBuffer;
      }
    }

    return 0;
  }

  private async executeWasmCommand(name: string, ctx: CommandContext): Promise<number> {
    const jsPath = `/bin/${name}.js`;
    if (await this.vfs.exists(jsPath)) {
      // Execute via jsCmd (Native JS Engine)
      return await jsCmd({
        ...ctx,
        args: [jsPath, ...ctx.args],
      });
    }

    const wasmPath = `/bin/${name}.wasm`;
    const exists = await this.vfs.exists(wasmPath);

    if (!exists) {
      ctx.stderr(`${name}: command not found (try 'help' or 'wpm list')\r\n`);
      return 127;
    }

    try {
      const wasmBytes = await this.vfs.readFile(wasmPath);
      const envRecord: Record<string, string> = {};
      for (const [k, v] of ctx.env.entries()) {
        envRecord[k] = v;
      }

      const res = await WasmRunner.run(wasmBytes, {
        args: [name, ...ctx.args],
        env: envRecord,
        stdin: ctx.stdin,
        stdout: (data) => ctx.stdout(new TextDecoder().decode(data)),
        stderr: (data) => ctx.stderr(new TextDecoder().decode(data)),
      });

      return res.exitCode;
    } catch (e: any) {
      ctx.stderr(`Failed to execute ${name}.wasm: ${e.message}\r\n`);
      return 1;
    }
  }
}
