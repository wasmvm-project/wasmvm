import { VFSManager } from '../vfs/vfs-manager';

export interface CommandContext {
  args: string[];
  stdin: string;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  vfs: VFSManager;
  env: Map<string, string>;
  isRaw?: boolean;
}

export interface CommandResult {
  exitCode: number;
  output?: string;
  error?: string;
}

export type BuiltinCommandFn = (ctx: CommandContext) => Promise<number | void>;

export interface ParsedSingleCommand {
  name: string;
  args: string[];
  redirectOut?: { file: string; append: boolean };
  redirectIn?: { file: string };
}

export interface ParsedPipeline {
  commands: ParsedSingleCommand[];
}

export interface ParsedStatement {
  pipelines: {
    pipeline: ParsedPipeline;
    op: '&&' | '||' | ';' | null;
  }[];
}
