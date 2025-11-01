#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🚀 Running CLI Integration Tests...\n');

const tests = [
  {
    name: 'Help command',
    command: 'npx ts-node src/script/package-health.ts --help',
    shouldPass: true
  },
  {
    name: 'Missing URL (should fail)',
    command: 'npx ts-node src/script/package-health.ts analyze',
    shouldPass: false
  },
  {
    name: 'Invalid URL (should fail)',
    command: 'npx ts-node src/script/package-health.ts analyze invalid-url',
    shouldPass: false
  },
  {
    name: 'Valid GitHub URL',
    command: 'npx ts-node src/script/package-health.ts analyze https://github.com/octocat/Hello-World',
    shouldPass: true
  }
];

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
  console.log(`${index + 1}. ${test.name}`);
  console.log(`   Command: ${test.command}`);
  
  try {
    const output = execSync(test.command, { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    if (test.shouldPass) {
      console.log('   ✅ PASS\n');
      passed++;
    } else {
      console.log('   ❌ FAIL: Expected to fail but passed\n');
      failed++;
    }
  } catch (error) {
    if (!test.shouldPass) {
      console.log('   ✅ PASS: Correctly failed\n');
      passed++;
    } else {
      console.log('   ❌ FAIL: Expected to pass but failed\n');
      console.log(`   Error: ${error.message.split('\n')[0]}\n`);
      failed++;
    }
  }
});

console.log('📊 Test Results:');
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   📈 Total:  ${tests.length}`);

process.exit(failed > 0 ? 1 : 0);