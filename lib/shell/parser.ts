import { ParsedPipeline, ParsedSingleCommand, ParsedStatement } from './types';

export class ShellParser {
  /**
   * 環境変数の展開 ($VAR or ${VAR})
   */
  public static expandEnv(input: string, env: Map<string, string>): string {
    return input.replace(/\$(\w+|\{[^}]+\})/g, (_, varName) => {
      const cleanName = varName.startsWith('{') && varName.endsWith('}')
        ? varName.slice(1, -1)
        : varName;
      return env.get(cleanName) ?? '';
    });
  }

  /**
   * 文字列をトークン分割（クォート・エスケープを考慮）
   */
  public static tokenize(input: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escapeNext = false;

    for (let i = 0; i < input.length; i++) {
      const char = input[i];

      if (escapeNext) {
        current += char;
        escapeNext = false;
        continue;
      }

      if (char === '\\' && !inSingleQuote) {
        escapeNext = true;
        continue;
      }

      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        continue;
      }

      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        continue;
      }

      if (!inSingleQuote && !inDoubleQuote) {
        if (/\s/.test(char)) {
          if (current.length > 0) {
            tokens.push(current);
            current = '';
          }
          continue;
        }

        // Special tokens: |, >, >>, <, &&, ||, ;
        if (['|', '>', '<', ';', '&'].includes(char)) {
          if (current.length > 0) {
            tokens.push(current);
            current = '';
          }

          // Check multi-character tokens: >>, &&, ||
          if (char === '>' && input[i + 1] === '>') {
            tokens.push('>>');
            i++;
          } else if (char === '&' && input[i + 1] === '&') {
            tokens.push('&&');
            i++;
          } else if (char === '|' && input[i + 1] === '|') {
            tokens.push('||');
            i++;
          } else {
            tokens.push(char);
          }
          continue;
        }
      }

      current += char;
    }

    if (current.length > 0) {
      tokens.push(current);
    }

    return tokens;
  }

  /**
   * トークン列から ParsedStatement（Pipeline と 接続演算子）を構築
   */
  public static parse(input: string, env: Map<string, string>): ParsedStatement {
    const expanded = this.expandEnv(input, env);
    const tokens = this.tokenize(expanded);

    const statement: ParsedStatement = { pipelines: [] };
    let currentPipelineTokens: string[] = [];
    let lastOp: '&&' | '||' | ';' | null = null;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token === '&&' || token === '||' || token === ';') {
        if (currentPipelineTokens.length > 0) {
          statement.pipelines.push({
            pipeline: this.parsePipeline(currentPipelineTokens),
            op: lastOp,
          });
          currentPipelineTokens = [];
        }
        lastOp = token as '&&' | '||' | ';';
      } else {
        currentPipelineTokens.push(token);
      }
    }

    if (currentPipelineTokens.length > 0) {
      statement.pipelines.push({
        pipeline: this.parsePipeline(currentPipelineTokens),
        op: lastOp,
      });
    }

    return statement;
  }

  private static parsePipeline(tokens: string[]): ParsedPipeline {
    const pipeline: ParsedPipeline = { commands: [] };
    let currentCmdTokens: string[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token === '|') {
        if (currentCmdTokens.length > 0) {
          pipeline.commands.push(this.parseSingleCommand(currentCmdTokens));
          currentCmdTokens = [];
        }
      } else {
        currentCmdTokens.push(token);
      }
    }

    if (currentCmdTokens.length > 0) {
      pipeline.commands.push(this.parseSingleCommand(currentCmdTokens));
    }

    return pipeline;
  }

  private static parseSingleCommand(tokens: string[]): ParsedSingleCommand {
    const cmd: ParsedSingleCommand = {
      name: '',
      args: [],
    };

    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i];
      if (token === '>') {
        const file = tokens[i + 1];
        if (file) {
          cmd.redirectOut = { file, append: false };
          i += 2;
          continue;
        }
      } else if (token === '>>') {
        const file = tokens[i + 1];
        if (file) {
          cmd.redirectOut = { file, append: true };
          i += 2;
          continue;
        }
      } else if (token === '<') {
        const file = tokens[i + 1];
        if (file) {
          cmd.redirectIn = { file };
          i += 2;
          continue;
        }
      } else {
        if (!cmd.name) {
          cmd.name = token;
        } else {
          cmd.args.push(token);
        }
      }
      i++;
    }

    return cmd;
  }
}
