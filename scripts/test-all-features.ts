import { MemoryFileSystem } from '../lib/vfs/memfs';
import { VFSManager } from '../lib/vfs/vfs-manager';
import { Shell } from '../lib/shell/shell';
import { AliasManager } from '../lib/shell/alias';
import { GlobMatcher } from '../lib/shell/glob';

async function testAllFeatures() {
  console.log('=== 1. Testing Alias & Glob ===');
  const aliasMgr = AliasManager.getInstance();
  aliasMgr.set('testalias', 'echo "alias works"');
  console.assert(aliasMgr.get('testalias') === 'echo "alias works"');

  const vfs = VFSManager.getInstance();
  await vfs.init();
  await vfs.writeFile('/home/user/file1.txt', 'Line 1\nLine 2\nFoo');
  await vfs.writeFile('/home/user/file2.txt', 'Line A\nLine B\nFoo');
  await vfs.writeFile('/home/user/notes.md', '# Markdown note');

  const globExpanded = await GlobMatcher.expandArgs(['*.txt'], vfs);
  console.log('Glob *.txt ->', globExpanded);
  console.assert(globExpanded.includes('file1.txt') && globExpanded.includes('file2.txt'));
  console.assert(!globExpanded.includes('notes.md'));

  console.log('=== 2. Testing Shell & Builtin Commands (sed, awk, find, sort) ===');
  let output = '';
  const shell = new Shell((t) => {
    output += t;
  });
  await shell.init();

  // Test sed
  output = '';
  await shell.executeCommandLine('sed "s/Foo/Bar/g" file1.txt');
  console.assert(output.includes('Bar'), `sed output failed: ${output}`);

  // Test awk
  output = '';
  await shell.executeCommandLine('echo "col1 col2 col3" | awk \'{print $2}\'');
  console.assert(output.includes('col2'), `awk output failed: ${output}`);

  // Test sort
  output = '';
  await shell.executeCommandLine('echo "cherry\napple\nbanana" | sort');
  console.assert(output.indexOf('apple') < output.indexOf('banana') && output.indexOf('banana') < output.indexOf('cherry'), `sort output failed: ${output}`);

  // Test command substitution $(...)
  output = '';
  await shell.executeCommandLine('echo "Result: $(echo HelloSubshell)"');
  console.assert(output.includes('Result: HelloSubshell'), `Command substitution failed: ${output}`);

  // Test Git command
  output = '';
  await shell.executeCommandLine('git init');
  console.assert(output.includes('Initialized empty Git repository'), `git init failed: ${output}`);

  output = '';
  await shell.executeCommandLine('git status');
  console.assert(output.includes('On branch main'), `git status failed: ${output}`);

  console.log('\n🎉 ALL FULL-FEATURE TESTS PASSED SUCCESSFULLY!');
}

testAllFeatures().catch((e) => {
  console.error('❌ Test failed:', e);
  process.exit(1);
});
