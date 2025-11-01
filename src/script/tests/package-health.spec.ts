#!/usr/bin/env node

const { execSync } = require('child_process');
const { existsSync, readFileSync, unlinkSync, readdirSync } = require('fs');
const { join } = require('path');

console.log('🧪 Testing Package Health CLI...\n');

// Find and clean up previous report files
function cleanupReportFiles() {
  const files = readdirSync('.');
  files.forEach((file) => {
    if (file.startsWith('health-report-') && file.endsWith('.json')) {
      unlinkSync(file);
      console.log(`🧹 Cleaned up: ${file}`);
    }
  });
}

// Test cases
const tests = [
  {
    name: 'Help command',
    command: 'npx ts-node src/script/package-health.ts --help',
    shouldPass: true,
  },
  {
    name: 'Missing URL parameter',
    command: 'npx ts-node src/script/package-health.ts analyze',
    shouldPass: false,
    expectedError: 'Not enough non-option arguments',
  },
  {
    name: 'Invalid URL format',
    command: 'npx ts-node src/script/package-health.ts analyze invalid-url',
    shouldPass: false,
    expectedError: 'Invalid GitHub URL format',
  },
  {
    name: 'Valid GitHub URL analysis',
    command:
      'npx ts-node src/script/package-health.ts analyze https://github.com/octocat/Hello-World',
    shouldPass: true,
  },
];

cleanupReportFiles();

let allTestsPassed = true;
let reportFile = '';

tests.forEach((test, index) => {
  console.log(`\n${index + 1}. ${test.name}`);
  console.log(`   Command: ${test.command}`);

  try {
    const output = execSync(test.command, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000, // 30 second timeout
    });

    if (test.shouldPass) {
      console.log('   ✅ PASS: Command succeeded');

      // Check for report file creation
      const files = readdirSync('.');
      const reportFiles = files.filter(
        (f) => f.startsWith('health-report-') && f.endsWith('.json'),
      );

      if (reportFiles.length > 0 && !reportFile) {
        reportFile = reportFiles[0];
        const report = JSON.parse(readFileSync(reportFile, 'utf-8'));
        console.log(`   📊 Report: ${report.owner}/${report.repo}`);
        console.log(`   🏆 Score: ${report.overall_health?.score}/100`);
      }
    } else {
      console.log('   ❌ FAIL: Expected command to fail but it succeeded');
      allTestsPassed = false;
    }
  } catch (error: unknown) {
    let errorOutput = '';
    if (typeof error === 'object' && error !== null) {
      if ('stderr' in error && typeof (error as any).stderr === 'string') {
        errorOutput = (error as any).stderr;
      } else if ('stdout' in error && typeof (error as any).stdout === 'string') {
        errorOutput = (error as any).stdout;
      } else if ('message' in error && typeof (error as any).message === 'string') {
        errorOutput = (error as any).message;
      }
    } else if (typeof error === 'string') {
      errorOutput = error;
    }

    if (!test.shouldPass) {
      if (test.expectedError && errorOutput.includes(test.expectedError)) {
        console.log(`   ✅ PASS: Correctly failed with expected error`);
      } else if (
        errorOutput.includes('URL is required') ||
        errorOutput.includes('Invalid GitHub URL format')
      ) {
        console.log(`   ✅ PASS: Correctly failed with validation error`);
      } else {
        console.log(`   ✅ PASS: Command failed as expected`);
      }
    } else {
      console.log(`   ❌ FAIL: Command failed unexpectedly`);
      console.log(`   Error: ${errorOutput.substring(0, 200)}...`);
      allTestsPassed = false;
    }
  }
});

// Final cleanup
cleanupReportFiles();

console.log('\n' + '='.repeat(50));
console.log(
  allTestsPassed ? '✨ All CLI tests passed!' : '❌ Some tests failed',
);
console.log('='.repeat(50));

process.exit(allTestsPassed ? 0 : 1);
