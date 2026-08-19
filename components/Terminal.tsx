'use client';

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import '@xterm/xterm/css/xterm.css';
import { Shell } from '../lib/shell/shell';

export interface TerminalHandle {
  sendKey: (data: string) => void;
  runCommand: (cmd: string) => void;
}

interface TerminalProps {
  onInitFinished?: (isOPFS: boolean) => void;
}

export const TerminalComponent = forwardRef<TerminalHandle, TerminalProps>(
  ({ onInitFinished }, ref) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermInstance = useRef<any>(null);
    const fitAddonRef = useRef<any>(null);
    const shellRef = useRef<Shell | null>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const [isReady, setIsReady] = useState(false);

    useImperativeHandle(ref, () => ({
      sendKey: (data: string) => {
        if (shellRef.current && xtermInstance.current) {
          xtermInstance.current.focus();
          shellRef.current.handleKeyInput(data);
        }
      },
      runCommand: (cmd: string) => {
        if (shellRef.current && xtermInstance.current) {
          xtermInstance.current.focus();
          for (const char of cmd) {
            shellRef.current.handleKeyInput(char);
          }
          shellRef.current.handleKeyInput('\r');
        }
      },
    }));

    useEffect(() => {
      let isMounted = true;

      const initTerminal = async () => {
        if (!terminalRef.current || xtermInstance.current) return;

        // Dynamic imports for browser-only execution
        const { Terminal } = await import('@xterm/xterm');
        const { FitAddon } = await import('@xterm/addon-fit');
        const { WebLinksAddon } = await import('@xterm/addon-web-links');

        if (!isMounted) return;

        const term = new Terminal({
          cursorBlink: true,
          cursorStyle: 'bar',
          fontSize: 14,
          fontFamily: 'Menlo, Monaco, "Cascadia Code", "Fira Code", monospace',
          letterSpacing: 0,
          lineHeight: 1.25,
          theme: {
            background: '#0a0f1d',
            foreground: '#e2e8f0',
            cursor: '#38bdf8',
            cursorAccent: '#0a0f1d',
            selectionBackground: '#334155',
            black: '#1e293b',
            red: '#f87171',
            green: '#4ade80',
            yellow: '#fbbf24',
            blue: '#60a5fa',
            magenta: '#c084fc',
            cyan: '#38bdf8',
            white: '#f1f5f9',
            brightBlack: '#475569',
            brightRed: '#ef4444',
            brightGreen: '#22c55e',
            brightYellow: '#eab308',
            brightBlue: '#3b82f6',
            brightMagenta: '#a855f7',
            brightCyan: '#06b6d4',
            brightWhite: '#ffffff',
          },
          allowProposedApi: true,
          convertEol: true, // Automatically convert LF (\n) to CRLF (\r\n) to prevent staircasing
        });

        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();

        term.loadAddon(fitAddon);
        term.loadAddon(webLinksAddon);

        term.open(terminalRef.current);
        fitAddon.fit();

        xtermInstance.current = term;
        fitAddonRef.current = fitAddon;

        // Initialize Shell with newline-normalized writer
        const shell = new Shell((text: string) => {
          // Normalize \n to \r\n (prevent staircase effect)
          const normalized = text.replace(/(?<!\r)\n/g, '\r\n');
          term.write(normalized);
        });
        shellRef.current = shell;

        // Display Clean Banner
        const banner = [
          '\x1b[1;36m',
          '  ____ ___  ___ __ _____ __ _ ',
          ' |_ / _ \\ |/ / \'  \\ V / \'  \\',
          ' /___\\___/_|__/_|_|_\\_/|_|_|_|  \x1b[0m\x1b[1;32mv1.0.0 (Browser POSIX)\x1b[0m',
          '',
          '\x1b[90m------------------------------------------------------------------\x1b[0m',
          '  * 0ms latency JS Built-in commands & WASI WebAssembly Engine',
          '  * Native OPFS persistent storage initialized',
          '  * Type \x1b[1;33m\'help\'\x1b[0m to list commands, \x1b[1;33m\'wpm list\'\x1b[0m to browse packages',
          '\x1b[90m------------------------------------------------------------------\x1b[0m',
          '',
        ].join('\r\n');
        term.write(banner);

        await shell.init();
        shell.writePrompt();
        setIsReady(true);

        onInitFinished?.(true);

        // Terminal data listener
        term.onData((data) => {
          shell.handleKeyInput(data);
        });

        // Resize observer to auto-fit when the container size changes (e.g., keyboard opening)
        resizeObserverRef.current = new ResizeObserver(() => {
          try {
            fitAddon.fit();
          } catch {}
        });

        if (terminalRef.current) {
          resizeObserverRef.current.observe(terminalRef.current);
        }
      };

      initTerminal();

      return () => {
        isMounted = false;
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect();
          resizeObserverRef.current = null;
        }
        if (xtermInstance.current) {
          xtermInstance.current.dispose();
          xtermInstance.current = null;
        }
      };
    }, []);

    return (
      <div className="relative w-full h-full bg-[#0a0f1d] overflow-hidden">
        <div
          ref={terminalRef}
          className="w-full h-full p-2 pl-3"
          style={{ height: '100%' }}
        />
      </div>
    );
  }
);

TerminalComponent.displayName = 'TerminalComponent';
