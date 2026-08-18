<div align="center">

# ⚡ wasmvm

**Ultra-lightweight, 0ms-startup POSIX Terminal & WebAssembly OS in your browser.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-wasmvm.fukayatti0.dev-00f2fe?style=for-the-badge&logo=vercel)](https://wasmvm.fukayatti0.dev)
[![WebAssembly](https://img.shields.io/badge/WebAssembly-WASI%20Preview%201-654FF0?style=for-the-badge&logo=webassembly)](https://webassembly.org)
[![Storage](https://img.shields.io/badge/Storage-Native%20OPFS-10b981?style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)
[![Next.js](https://img.shields.io/badge/Next.js-16%20Turbopack-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](./LICENSE)

[🌐 **Try Live Demo (wasmvm.fukayatti0.dev)**](https://wasmvm.fukayatti0.dev) • [📖 English](#-overview) • [🇯🇵 日本語](#-日本語概要)

---

</div>

## 💡 Overview

Heavy Linux virtual machines (like WebVM / v86) emulate entire x86/RISC-V hardware and boot a full Linux kernel, resulting in hundreds of megabytes of memory usage, seconds of boot time, and high CPU emulation overhead.

**wasmvm** takes a radically different, ultra-modern approach:
Instead of emulating hardware, it directly intercepts POSIX system calls using browser-native APIs (**JavaScript + WebAssembly WASI + Origin Private File System**).

- **0ms Instant Startup**: Ultra-fast built-in commands (`cd`, `ls`, `grep`, `sed`, `cat`, etc.) execute natively in JS with zero initialization delay.
- **WASI WebAssembly Runtime**: Standalone `.wasm` tools and language runtimes (Python, SQLite, QuickJS, Lua, Tiny C Compiler) run at near-native speed.
- **Native OPFS Persistence**: Files in `/home/user`, `/bin`, `/etc` are stored directly in the browser's high-speed Origin Private File System and persist across reloads.
- **Optimized for iPhone / Safari**: Fully leverages WebKit's native JIT compiler (BBQJIT / OMG JIT) with zero JIT sandbox restrictions.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Frontend UI & IDE Layer                         │
│   (xterm.js + Monaco Code Editor + File Explorer + Mobile Toolbar)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Core Layer (JavaScript / VFS)                      │
│                                                                        │
│  [ Built-in Commands ] ──> `cd`, `ls`, `grep`, `sed`, `awk` (0ms)      │
│  [ Virtual Filesystem] ──> OPFS (Origin Private File System)           │
│  [ Shell & Pipelines ] ──> Glob (`*.txt`), Substitutions, Aliases, Git │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌───────────────────────────────┐┌───────────────────────────────────────┐
│     WASI WebAssembly Engine   ││       WASM Package Manager (wpm)      │
│                               ││                                       │
│  • Python 3 (MicroPython WASI)││  • Standalone single `.wasm` packages │
│  • SQLite3 (SQL Database)     ││  • On-demand fetching & Cache API     │
│  • QuickJS & Lua 5.4          ││  • GUI Store modal & CLI installer    │
│  • Tiny C Compiler (TCC)      ││  • Stored in `/bin/<pkg>.wasm` (OPFS) │
└───────────────────────────────┘└───────────────────────────────────────┘
```

---

## ✨ Features

### 1. ⚡ 0ms Built-in Commands & BusyBox Utilities
- **File System**: `ls` (`-lah`, colored), `cd`, `pwd`, `cat`, `touch`, `mkdir` (`-p`), `rm` (`-rf`), `cp`, `mv`
- **Text & Stream Processing**: `echo`, `grep` (`-inv`), `head`, `tail`, `wc`, `sed`, `awk`, `find`, `sort`, `uniq`, `cut`, `tr`, `base64`
- **Pipelines & Redirection**: `cat file | grep text | sort > result.txt`, `echo "hi" >> memo.txt`
- **Shell Features**: Glob wildcard expansion (`*.txt`), Command substitutions (`$(date)`), Aliases (`alias ll='ls -la'`), Auto-loaded `.bashrc`

### 2. 🐍 Real Language Runtimes in WebAssembly
- **Python 3**: MicroPython WebAssembly runtime (`python script.py`, `python -c "print(2**10)"`)
- **SQLite3**: In-browser SQL database engine (`sqlite3 app.db "SELECT * FROM users;"`)
- **JavaScript**: QuickJS / Node.js script runner (`node app.js`, `node -e "..."`)
- **C Compiler**: Tiny C Compiler for browser-native C compilation (`tcc`)
- **Lua 5.4**: Lightweight embedded scripting (`lua`)

### 3. 💻 Monaco Code Editor (VSCode in Browser)
- Type `code <filename>` or click files in the Explorer to open a full VSCode-powered code editor.
- Syntax highlighting for Python, TypeScript, JS, C, Rust, Shell, JSON, Markdown, HTML, CSS, SQL.
- Press <kbd>Ctrl+S</kbd> / <kbd>Cmd+S</kbd> to save directly into OPFS.

### 4. 🐙 In-Browser Git (`isomorphic-git`)
- Fully functional version control backed by OPFS.
- `git init`, `git status`, `git add`, `git commit -m "msg"`, `git log`, `git clone <url>`

### 5. 📱 iPhone & Mobile Optimized
- Dedicated on-screen quick-action toolbar: `Tab`, `Ctrl+C`, `Esc`, `|`, `>`, `<`, `/`, `-`, `~`, `↑`, `↓`, `Enter`.
- Install as a PWA (Add to Home Screen) for an offline, standalone POSIX mobile workstation.

### 6. 📁 Local Folder Mount (File System Access API)
- Click **Mount PC** or run `mount-local` on Chrome/Edge to directly mount and edit local folders on your computer under `/mnt/<folder>`.

---

## 🚀 Quick Start (Local Development)

```bash
# 1. Clone the repository
git clone https://github.com/fukayatti0/wasmvm.git
cd wasmvm

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📋 Example Shell Sessions

```bash
# Basic file operations with 0ms latency
user@wasmvm:~$ mkdir projects && cd projects
user@wasmvm:~/projects$ echo "Hello from wasmvm!" > hello.txt
user@wasmvm:~/projects$ cat hello.txt | tr 'a-z' 'A-Z'
HELLO FROM WASMVM!

# Run real Python 3 code
user@wasmvm:~/projects$ python -c "import sys; print('Python', sys.version)"
Python 3.4.0; MicroPython v1.28.0

# Create and query SQLite database
user@wasmvm:~/projects$ sqlite3 my.db "CREATE TABLE devs (id INT, name TEXT); INSERT INTO devs VALUES (1, 'Alice'); SELECT * FROM devs;"
id           | name        
-------------+-------------
1            | Alice       

# Open VSCode Editor
user@wasmvm:~/projects$ code script.py
```

---

## 🇯🇵 日本語概要

### なぜ wasmvm なのか？
従来のブラウザLinuxエミュレータ（WebVMやv86など）は、仮想CPU上でLinuxカーネルを丸ごとブートするため、数百MBのメモリ消費、長い起動待機時間、CPUエミュレーションの二重オーバーヘッドという課題がありました。

**wasmvm** は、ハードウェアのエミュレートを捨て、**POSIXシステムコールをブラウザネイティブAPI（JS ＋ WebAssembly WASI ＋ OPFS）で直接肩代わりする**ことで、以下の圧倒的なメリットを実現した次世代ブラウザOS環境です。

1. **起動0ms**: よく使うコマンド（`cd`, `ls`, `grep`, `sed`, `cat` 等）はJS直接実行でオーバーヘッドゼロ。
2. **OPFS高速永続化**: ブラウザをリロードしてもファイルが消えない高速ファイルシステム。
3. **WebKit JIT 最適化**: iPhone / iPad の Safari でも Apple Silicon のネイティブJITがフル稼働。
4. **本物の開発体験**: Python、SQLite3、Monaco Editor (VSCode)、Git、PCローカルフォルダマウントを統合。

---

## 📄 License

MIT License © 2026 [fukayatti0](https://github.com/fukayatti0)
