import { execSync } from 'child_process';
import { existsSync, readFileSync, unlinkSync, readdirSync } from 'fs';

// Mock-based CLI tests that don't hit real APIs
describe('Package Health CLI (Mocked)', () => {
  const testRepo = 'https://github.com/octocat/Hello-World';

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

  it('should successfully analyze a repository with mocked services', () => {
    const output = execSync(
      `npx ts-node src/script/package-health.ts analyze ${testRepo}`,
      { encoding: 'utf-8', timeout: 30000 },
    );

    // Check for success indicators
    expect(output).toMatch(/Starting analysis for octocat\/Hello-World/);
    expect(output).toMatch(/Analysis Complete/);
    expect(output).toMatch(/Report saved to/);
    expect(output).toMatch(/Overall Health: \d+\/100/);

    // Check if report file was created
    const files = readdirSync('.');
    const reportFiles = files.filter(
      (f) => f.startsWith('health-report-') && f.endsWith('.json'),
    );
    expect(reportFiles.length).toBeGreaterThan(0);

    // Verify report content
    if (reportFiles.length > 0) {
      const report = JSON.parse(readFileSync(reportFiles[0], 'utf-8'));
      expect(report.owner).toBe('octocat');
      expect(report.repo).toBe('Hello-World');
      expect(report.overall_health).toBeDefined();
      expect(report.overall_health.score).toBeGreaterThan(0);
      expect(report.dependency_health).toBeDefined();
      expect(report.analysis_timestamp).toBeDefined();
    }
  });

  it('should work with token flag (ignored in mocks)', () => {
    const output = execSync(
      `npx ts-node src/script/package-health.ts analyze ${testRepo} --token=fake-token`,
      { encoding: 'utf-8', timeout: 30000 },
    );

    expect(output).toMatch(/Analysis Complete/);

    const files = readdirSync('.');
    const reportFiles = files.filter(
      (f) => f.startsWith('health-report-') && f.endsWith('.json'),
    );
    expect(reportFiles.length).toBeGreaterThan(0);
  });
});
