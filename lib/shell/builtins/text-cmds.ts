import { CommandContext } from '../types';

export const echoCmd = async (ctx: CommandContext): Promise<number> => {
  let noNewline = false;
  let args = ctx.args;

  if (args[0] === '-n') {
    noNewline = true;
    args = args.slice(1);
  }

  const output = args.join(' ');
  ctx.stdout(output + (noNewline ? '' : '\r\n'));
  return 0;
};

export const grepCmd = async (ctx: CommandContext): Promise<number> => {
  let ignoreCase = false;
  let invertMatch = false;
  let lineNumbers = false;
  const patterns: string[] = [];
  const files: string[] = [];

  for (let i = 0; i < ctx.args.length; i++) {
    const arg = ctx.args[i];
    if (arg.startsWith('-')) {
      if (arg.includes('i')) ignoreCase = true;
      if (arg.includes('v')) invertMatch = true;
      if (arg.includes('n')) lineNumbers = true;
    } else if (patterns.length === 0) {
      patterns.push(arg);
    } else {
      files.push(arg);
    }
  }

  if (patterns.length === 0) {
    ctx.stderr('grep: missing pattern\r\n');
    return 1;
  }

  const patternStr = patterns[0];
  const regex = new RegExp(patternStr, ignoreCase ? 'i' : '');

  const processContent = (content: string, prefix = ''): boolean => {
    let matchedAny = false;
    const lines = content.split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (line.length === 0 && idx === lines.length - 1) return;
      const isMatch = regex.test(line);
      const outputLine = invertMatch ? !isMatch : isMatch;
      if (outputLine) {
        matchedAny = true;
        let lineOut = prefix;
        if (lineNumbers) {
          lineOut += `\x1b[32m${idx + 1}\x1b[0m:`;
        }
        lineOut += line;
        ctx.stdout(lineOut + '\r\n');
      }
    });
    return matchedAny;
  };

  let foundMatch = false;

  if (files.length === 0) {
    if (ctx.stdin) {
      foundMatch = processContent(ctx.stdin);
    }
  } else {
    for (const file of files) {
      try {
        const text = await ctx.vfs.readTextFile(file);
        const prefix = files.length > 1 ? `\x1b[35m${file}\x1b[0m:` : '';
        const match = processContent(text, prefix);
        if (match) foundMatch = true;
      } catch {
        ctx.stderr(`grep: ${file}: No such file or directory\r\n`);
      }
    }
  }

  return foundMatch ? 0 : 1;
};

export const headCmd = async (ctx: CommandContext): Promise<number> => {
  let linesCount = 10;
  const files: string[] = [];

  for (let i = 0; i < ctx.args.length; i++) {
    const arg = ctx.args[i];
    if (arg === '-n' && ctx.args[i + 1]) {
      linesCount = parseInt(ctx.args[i + 1], 10) || 10;
      i++;
    } else if (arg.startsWith('-n')) {
      linesCount = parseInt(arg.slice(2), 10) || 10;
    } else {
      files.push(arg);
    }
  }

  const printHead = (content: string, header = '') => {
    if (header) ctx.stdout(header + '\r\n');
    const lines = content.split(/\r?\n/).slice(0, linesCount);
    ctx.stdout(lines.join('\r\n') + '\r\n');
  };

  if (files.length === 0) {
    if (ctx.stdin) printHead(ctx.stdin);
  } else {
    for (const file of files) {
      try {
        const text = await ctx.vfs.readTextFile(file);
        const header = files.length > 1 ? `==> ${file} <==` : '';
        printHead(text, header);
      } catch {
        ctx.stderr(`head: cannot open '${file}': No such file or directory\r\n`);
      }
    }
  }
  return 0;
};

export const tailCmd = async (ctx: CommandContext): Promise<number> => {
  let linesCount = 10;
  const files: string[] = [];

  for (let i = 0; i < ctx.args.length; i++) {
    const arg = ctx.args[i];
    if (arg === '-n' && ctx.args[i + 1]) {
      linesCount = parseInt(ctx.args[i + 1], 10) || 10;
      i++;
    } else if (arg.startsWith('-n')) {
      linesCount = parseInt(arg.slice(2), 10) || 10;
    } else {
      files.push(arg);
    }
  }

  const printTail = (content: string, header = '') => {
    if (header) ctx.stdout(header + '\r\n');
    const lines = content.split(/\r?\n/);
    const sliced = lines.slice(Math.max(0, lines.length - linesCount));
    ctx.stdout(sliced.join('\r\n') + '\r\n');
  };

  if (files.length === 0) {
    if (ctx.stdin) printTail(ctx.stdin);
  } else {
    for (const file of files) {
      try {
        const text = await ctx.vfs.readTextFile(file);
        const header = files.length > 1 ? `==> ${file} <==` : '';
        printTail(text, header);
      } catch {
        ctx.stderr(`tail: cannot open '${file}': No such file or directory\r\n`);
      }
    }
  }
  return 0;
};

export const wcCmd = async (ctx: CommandContext): Promise<number> => {
  let countLines = false;
  let countWords = false;
  let countBytes = false;
  const files: string[] = [];

  for (const arg of ctx.args) {
    if (arg.startsWith('-')) {
      if (arg.includes('l')) countLines = true;
      if (arg.includes('w')) countWords = true;
      if (arg.includes('c') || arg.includes('m')) countBytes = true;
    } else {
      files.push(arg);
    }
  }

  if (!countLines && !countWords && !countBytes) {
    countLines = countWords = countBytes = true;
  }

  const analyze = (content: string) => {
    const lines = content.split(/\r?\n/).length - 1;
    const words = content.trim().length === 0 ? 0 : content.trim().split(/\s+/).length;
    const bytes = new TextEncoder().encode(content).length;
    return { lines, words, bytes };
  };

  const formatStats = (stats: { lines: number; words: number; bytes: number }, label = '') => {
    const parts: string[] = [];
    if (countLines) parts.push(stats.lines.toString().padStart(7, ' '));
    if (countWords) parts.push(stats.words.toString().padStart(7, ' '));
    if (countBytes) parts.push(stats.bytes.toString().padStart(7, ' '));
    if (label) parts.push(` ${label}`);
    return parts.join(' ');
  };

  if (files.length === 0) {
    if (ctx.stdin) {
      const stats = analyze(ctx.stdin);
      ctx.stdout(formatStats(stats) + '\r\n');
    }
  } else {
    let total = { lines: 0, words: 0, bytes: 0 };
    for (const file of files) {
      try {
        const text = await ctx.vfs.readTextFile(file);
        const stats = analyze(text);
        total.lines += stats.lines;
        total.words += stats.words;
        total.bytes += stats.bytes;
        ctx.stdout(formatStats(stats, file) + '\r\n');
      } catch {
        ctx.stderr(`wc: ${file}: No such file or directory\r\n`);
      }
    }
    if (files.length > 1) {
      ctx.stdout(formatStats(total, 'total') + '\r\n');
    }
  }
  return 0;
};
