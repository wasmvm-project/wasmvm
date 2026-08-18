import { MemoryFileSystem } from '../lib/vfs/memfs';
import { VFSManager } from '../lib/vfs/vfs-manager';
import { ShellParser } from '../lib/shell/parser';
import { Shell } from '../lib/shell/shell';

async function testSuite() {
  console.log('--- 1. Testing MemoryFileSystem & VFSManager ---');
  const memfs = new MemoryFileSystem();
  await memfs.init();

  // Test writeFile & readFile
  await memfs.writeFile('/home/user/test.txt', 'Hello, wasmvm!');
  const content = await memfs.readTextFile('/home/user/test.txt');
  console.assert(content === 'Hello, wasmvm!', `Expected 'Hello, wasmvm!', got '${content}'`);

  // Test mkdir & readDir
  await memfs.mkdir('/home/user/mydir');
  await memfs.writeFile('/home/user/mydir/sub.txt', 'nested data');
  const entries = await memfs.readDir('/home/user');
  console.log('Entries in /home/user:', entries.map((e) => e.name));
  console.assert(entries.some((e) => e.name === 'test.txt'));
  console.assert(entries.some((e) => e.name === 'mydir'));

  console.log('--- 2. Testing ShellParser ---');
  const env = new Map<string, string>([
    ['USER', 'developer'],
    ['HOME', '/home/developer'],
  ]);

  const stmt1 = ShellParser.parse('echo "Hello $USER" | grep developer > out.txt', env);
  console.log('Parsed pipelines:', stmt1.pipelines.length);
  const p0 = stmt1.pipelines[0].pipeline;
  console.assert(p0.commands.length === 2, 'Expected 2 commands in pipeline');
  console.assert(p0.commands[0].name === 'echo');
  console.assert(p0.commands[0].args[0] === 'Hello developer');
  console.assert(p0.commands[1].name === 'grep');
  console.assert(p0.commands[1].args[0] === 'developer');
  console.assert(p0.commands[1].redirectOut?.file === 'out.txt');

  console.log('--- 3. Testing Shell Execution ---');
  let terminalBuffer = '';
  const shell = new Shell((text) => {
    terminalBuffer += text;
  });
  await shell.init();

  // Execute builtin command sequence
  await shell.executeCommandLine('echo "WASM is fast" > fast.txt');
  await shell.executeCommandLine('cat fast.txt');
  console.assert(terminalBuffer.includes('WASM is fast'), `Expected output to include 'WASM is fast', got: ${terminalBuffer}`);

  terminalBuffer = '';
  await shell.executeCommandLine('ls -la');
  console.log('ls output:\n' + terminalBuffer);

  terminalBuffer = '';
  await shell.executeCommandLine('help');
  console.assert(terminalBuffer.includes('wasmvm - Modern WebAssembly & OPFS Browser Shell'));

  console.log('\n✅ All automated tests passed successfully!');
}

testSuite().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
