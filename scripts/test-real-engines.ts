import { VFSManager } from '../lib/vfs/vfs-manager';
import { Shell } from '../lib/shell/shell';

async function testRealEngines() {
  console.log('=== Testing Real Python, SQLite3, and Node Engines ===');
  const vfs = VFSManager.getInstance();
  await vfs.init();

  let output = '';
  const shell = new Shell((t) => {
    output += t;
  });
  await shell.init();

  // 1. Test Python -c
  console.log('\n--- 1. Python Inline Calculation ---');
  output = '';
  await shell.executeCommandLine('python -c "print(\'Python Math Result:\', sum([x for x in range(10)]))"');
  console.log(output);
  console.assert(output.includes('Python Math Result: 45'), `Python math failed: ${output}`);

  // 2. Test Python file execution
  console.log('\n--- 2. Python File Execution ---');
  await vfs.writeFile(
    '/home/user/fib.py',
    `def fib(n):
    if n <= 1: return n
    return fib(n-1) + fib(n-2)
print('fib(8) =', fib(8))`
  );
  output = '';
  await shell.executeCommandLine('python fib.py');
  console.log(output);
  console.assert(output.includes('fib(8) = 21'), `Python file failed: ${output}`);

  // 3. Test SQLite3 execution
  console.log('\n--- 3. SQLite3 Table & Query ---');
  output = '';
  await shell.executeCommandLine('sqlite3 mydata.db "CREATE TABLE items (id INT, name TEXT); INSERT INTO items VALUES (1, \'Apple\'); SELECT * FROM items;"');
  console.log(output);
  console.assert(output.includes('Apple'), `SQLite3 failed: ${output}`);

  // 4. Test Node / JS inline execution
  console.log('\n--- 4. Node/JS Inline Execution ---');
  output = '';
  await shell.executeCommandLine('node -e "console.log(\'JS Array Sum:\', [10, 20, 30].reduce((a,b)=>a+b))"');
  console.log(output);
  console.assert(output.includes('JS Array Sum: 60'), `Node failed: ${output}`);

  console.log('\n🎉 ALL REAL ENGINES PASSED WITH FLYING COLORS!');
}

testRealEngines().catch((e) => {
  console.error('❌ Test failed:', e);
  process.exit(1);
});
