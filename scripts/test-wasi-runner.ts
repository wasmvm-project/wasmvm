import { WasmRunner } from '../lib/wasi/runner';
import * as fs from 'fs';
import * as path from 'path';

async function testWasiRunner() {
  console.log('--- Testing WASI Runner with cowsay.wasm ---');
  const wasmPath = path.join(__dirname, '../public/wasm/cowsay.wasm');
  const bytes = fs.readFileSync(wasmPath);

  const res = await WasmRunner.run(new Uint8Array(bytes), {
    args: ['cowsay'],
  });

  console.log('Exit Code:', res.exitCode);
  console.log('WASM stdout output:\n' + res.stdout);
  console.assert(res.exitCode === 0, 'Exit code should be 0');
  console.assert(res.stdout.includes('Hello from WebAssembly WASI'), 'Output should contain banner');

  console.log('✅ WASI Runner test passed successfully!');
}

testWasiRunner().catch((e) => {
  console.error('❌ WASI Runner test failed:', e);
  process.exit(1);
});
