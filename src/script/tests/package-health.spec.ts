import { execSync } from 'child_process';
import { existsSync, readFileSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';

// Increase timeout for CLI tests
jest.setTimeout(30000);

function cleanupReportFiles() {
  const files = readdirSync('.');
  files.forEach((file) => {
    if (file.startsWith('health-report-') && file.endsWith('.json')) {
      unlinkSync(file);
    }
  });
}

describe('Package Health CLI Integration', () => {
  beforeEach(() => {
    cleanupReportFiles();
  });

  afterAll(() => {
    cleanupReportFiles();
  });

  describe('CLI Command Validation', () => {
    it('should display help information when --help flag is used', () => {
      const output = execSync(
        'npx ts-node src/script/package-health.ts --help',
        {
          encoding: 'utf-8',
        },
      );

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
        // Accept either error message
        expect(output).toMatch(
          /Not enough non-option arguments|URL is required/,
        );
      }
    });

    it('should fail with invalid URL format', () => {
      try {
        execSync(
          'npx ts-node src/script/package-health.ts analyze invalid-url',
          {
            encoding: 'utf-8',
          },
        );
        fail('Expected command to fail');
      } catch (err: any) {
        const output = err.stderr || err.stdout || err.message;
        expect(output).toMatch(/Invalid GitHub URL format/);
      }
    });
  });

  describe('CLI Analysis Functionality', () => {
    it('should generate health report for valid GitHub repository', () => {
      // Use a small, fast repository for testing
      const output = execSync(
        'npx ts-node src/script/package-health.ts analyze https://github.com/octocat/Hello-World',
        { encoding: 'utf-8' },
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

      if (reportFiles.length > 0) {
        // Check report content
        const report = JSON.parse(readFileSync(reportFiles[0], 'utf-8'));
        expect(report.owner).toBe('octocat');
        expect(report.repo).toBe('Hello-World');
        expect(report.overall_health).toBeDefined();
        expect(report.dependency_health).toBeDefined();
      }
    });

    it('should accept GitHub token via --token flag', () => {
      const output = execSync(
        'npx ts-node src/script/package-health.ts analyze https://github.com/octocat/Hello-World --token=test-token-123',
        { encoding: 'utf-8' },
      );

      expect(output).toMatch(/Starting analysis for octocat\/Hello-World/);

      const files = readdirSync('.');
      const reportFiles = files.filter(
        (f) => f.startsWith('health-report-') && f.endsWith('.json'),
      );
      expect(reportFiles.length).toBeGreaterThan(0);
    });
  });
});
