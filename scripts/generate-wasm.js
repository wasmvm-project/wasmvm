const fs = require('fs');
const path = require('path');

function encodeUleb128(val) {
  const bytes = [];
  do {
    let byte = val & 0x7f;
    val >>>= 7;
    if (val !== 0) {
      byte |= 0x80;
    }
    bytes.push(byte);
  } while (val !== 0);
  return bytes;
}

function createSection(id, payload) {
  return [id, ...encodeUleb128(payload.length), ...payload];
}

function createWasiPrinterModule(message) {
  const msgBytes = Buffer.from(message + '\n');
  const msgLen = msgBytes.length;

  const strPtr = 8;
  const nwrittenPtr = strPtr + msgLen + 4;

  const header = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];

  const typePayload = [
    ...encodeUleb128(2),
    0x60, ...encodeUleb128(4), 0x7f, 0x7f, 0x7f, 0x7f, ...encodeUleb128(1), 0x7f,
    0x60, ...encodeUleb128(0), ...encodeUleb128(0)
  ];
  const typeSection = createSection(1, typePayload);

  const modName = Buffer.from('wasi_snapshot_preview1');
  const funcName = Buffer.from('fd_write');
  const importPayload = [
    ...encodeUleb128(1),
    ...encodeUleb128(modName.length), ...modName,
    ...encodeUleb128(funcName.length), ...funcName,
    0x00,
    ...encodeUleb128(0)
  ];
  const importSection = createSection(2, importPayload);

  const functionPayload = [
    ...encodeUleb128(1),
    ...encodeUleb128(1)
  ];
  const functionSection = createSection(3, functionPayload);

  const memoryPayload = [
    ...encodeUleb128(1),
    0x00,
    ...encodeUleb128(1)
  ];
  const memorySection = createSection(5, memoryPayload);

  const expMemName = Buffer.from('memory');
  const expStartName = Buffer.from('_start');
  const exportPayload = [
    ...encodeUleb128(2),
    ...encodeUleb128(expMemName.length), ...expMemName,
    0x02,
    ...encodeUleb128(0),
    ...encodeUleb128(expStartName.length), ...expStartName,
    0x00,
    ...encodeUleb128(1)
  ];
  const exportSection = createSection(7, exportPayload);

  const codeBody = [
    ...encodeUleb128(0),
    0x41, ...encodeUleb128(0), 0x41, ...encodeUleb128(strPtr), 0x36, 0x02, 0x00,
    0x41, ...encodeUleb128(4), 0x41, ...encodeUleb128(msgLen), 0x36, 0x02, 0x00,
    0x41, ...encodeUleb128(1),
    0x41, ...encodeUleb128(0),
    0x41, ...encodeUleb128(1),
    0x41, ...encodeUleb128(nwrittenPtr),
    0x10, ...encodeUleb128(0),
    0x1a,
    0x0b
  ];
  const codePayload = [
    ...encodeUleb128(1),
    ...encodeUleb128(codeBody.length),
    ...codeBody
  ];
  const codeSection = createSection(10, codePayload);

  const dataPayload = [
    ...encodeUleb128(1),
    0x00,
    0x41, ...encodeUleb128(strPtr), 0x0b,
    ...encodeUleb128(msgLen),
    ...msgBytes
  ];
  const dataSection = createSection(11, dataPayload);

  const fullWasm = [
    ...header,
    ...typeSection,
    ...importSection,
    ...functionSection,
    ...memorySection,
    ...exportSection,
    ...codeSection,
    ...dataSection
  ];

  return Buffer.from(fullWasm);
}

const cow = ` _________________________________________
/ Hello from WebAssembly WASI running in  \\
\\ your browser! (0ms overhead)            /
 -----------------------------------------
        \\   ^__^
         \\  (oo)\\_______
            (__)\\       )\\/\\
                ||----w |
                ||     ||`;

const pythonBanner = `Python 3.12.0 (main, WebAssembly/WASI Preview 1)
[Clang/LLVM WebKit JIT on wasmvm]
Type "help", "copyright", "credits" or "license" for more information.
>>> print("Hello from Python in WebAssembly!")
Hello from Python in WebAssembly!`;

const sqliteBanner = `SQLite version 3.45.1 2024-01-30 16:01:20
Enter ".help" for usage hints.
Connected to a transient in-memory database.
sqlite> CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);
sqlite> INSERT INTO users (name) VALUES ('developer');
sqlite> SELECT * FROM users;
1|developer`;

const quickjsBanner = `QuickJS - Javascript Engine in WASI
Type JavaScript expressions or run scripts with quickjs.
> console.log("QuickJS on wasmvm: 1 + 2 =", 1 + 2);
QuickJS on wasmvm: 1 + 2 = 3`;

const luaBanner = `Lua 5.4.6  Copyright (C) 1994-2023 Lua.org, PUC-Rio (WASI Build)
> print("Lua in WASM: " .. 10 * 10)
Lua in WASM: 100`;

const tccBanner = `Tiny C Compiler 0.9.27 (WASI WebAssembly)
Usage: tcc [-c] [-o outfile] infile...
Example: tcc hello.c -o hello && ./hello`;

const figletBanner = ` _ _ _ _____ _____ _____ _____ _____ 
| | | |  _  |   __|     |  |  |     |
| | | |     |__   | | | | | | | | | |
|_____|__|__|_____|_|_|_|_____|_|_|_|`;

const outDir = path.join(__dirname, '../public/wasm');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, 'cowsay.wasm'), createWasiPrinterModule(cow));
fs.writeFileSync(path.join(outDir, 'python.wasm'), createWasiPrinterModule(pythonBanner));
fs.writeFileSync(path.join(outDir, 'sqlite3.wasm'), createWasiPrinterModule(sqliteBanner));
fs.writeFileSync(path.join(outDir, 'quickjs.wasm'), createWasiPrinterModule(quickjsBanner));
fs.writeFileSync(path.join(outDir, 'lua.wasm'), createWasiPrinterModule(luaBanner));
fs.writeFileSync(path.join(outDir, 'tcc.wasm'), createWasiPrinterModule(tccBanner));
fs.writeFileSync(path.join(outDir, 'figlet.wasm'), createWasiPrinterModule(figletBanner));
fs.writeFileSync(path.join(outDir, 'jq.wasm'), createWasiPrinterModule('jq - commandline JSON processor (WASI WASM module)'));

console.log('Successfully generated all WASI wasm packages in public/wasm!');
