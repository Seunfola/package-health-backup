// src/script/tests/package-health.integration.spec.ts
import { execSync } from 'child_process';
import { existsSync, readFileSync, unlinkSync, readdirSync } from 'fs';

describe('Package Health CLI Integration', () => {
  function cleanupReportFiles() {
    const files = readdirSync('.');
    files.forEach((file) => {
      if (file.startsWith('health-report-') && file.endsWith('.json')) {
        unlinkSync(file);
      }
    });
  }

  beforeEach(() => {
    cleanupReportFiles();
  });

  afterAll(() => {
    cleanupReportFiles();
  });

  it('should display help information', () => {
    const output = execSync('npx ts-node src/script/package-health.ts --help', {
      encoding: 'utf-8',
    });

    expect(output).toMatch(/Analyze a GitHub repository/);
    expect(output).toMatch(/--help/);
    expect(output).toMatch(/Commands:/);
  });

  it('should fail when no URL is provided', () => {
    try {
      execSync('npx ts-node src/script/package-health.ts analyze', {
        encoding: 'utf-8',
      });
      fail('Expected command to fail');
    } catch (err: any) {
      const output = err.stderr || err.stdout || err.message;
      expect(output).toMatch(/Not enough non-option arguments|URL is required/);
    }
  });

  it('should fail with invalid URL format', () => {
    try {
      execSync('npx ts-node src/script/package-health.ts analyze invalid-url', {
        encoding: 'utf-8',
      });
      fail('Expected command to fail');
    } catch (err: any) {
      const output = err.stderr || err.stdout || err.message;
      expect(output).toMatch(/Invalid GitHub URL format/);
    }
  });

  it('should generate health report for valid GitHub repository', () => {
    const output = execSync(
      'npx ts-node src/script/package-health.ts analyze https://github.com/octocat/Hello-World',
      { encoding: 'utf-8', timeout: 30000 },
    );

    // Check console output
    expect(output).toMatch(/Starting analysis for octocat\/Hello-World/);
    expect(output).toMatch(/Analysis Complete/);
    expect(output).toMatch(/Report saved to/);

    // Check if report file was created
    const files = readdirSync('.');
    const reportFiles = files.filter(
      (f) => f.startsWith('health-report-') && f.endsWith('.json'),
    );
    expect(reportFiles.length).toBeGreaterThan(0);

    // Check report content
    const report = JSON.parse(readFileSync(reportFiles[0], 'utf-8'));
    expect(report.owner).toBe('octocat');
    expect(report.repo).toBe('Hello-World');
    expect(report.overall_health).toBeDefined();
    expect(report.dependency_health).toBeDefined();
    expect(typeof report.overall_health.score).toBe('number');
    expect(typeof report.dependency_health).toBe('number');
  });

  it('should accept GitHub token via --token flag', () => {
    const output = execSync(
      'npx ts-node src/script/package-health.ts analyze https://github.com/octocat/Hello-World --token=test-token-123',
      { encoding: 'utf-8', timeout: 30000 },
    );

    expect(output).toMatch(/Starting analysis for octocat\/Hello-World/);

    const files = readdirSync('.');
    const reportFiles = files.filter(
      (f) => f.startsWith('health-report-') && f.endsWith('.json'),
    );
    expect(reportFiles.length).toBeGreaterThan(0);
  });
});
