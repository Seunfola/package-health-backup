import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import { join } from 'node:path';

describe('Package Health CLI', () => {
  const scriptPath = join(__dirname, './package-health.ts');
  const reportPath = join(process.cwd(), 'health-report.json');

  beforeEach(() => {
    if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
  });

  afterAll(() => {
    if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
  });

  it('should fail when URL is missing', () => {
    try {
      execSync(`npx ts-node ${scriptPath}`, { encoding: 'utf-8' });
    } catch (err: any) {
      expect(err.stdout || err.stderr).toMatch(/URL is required/i);
      return;
    }
    throw new Error('Expected CLI to exit with an error');
  });

  it('should fail when URL format is invalid', () => {
    try {
      execSync(`npx ts-node ${scriptPath} analyze invalid-url`, {
        encoding: 'utf-8',
      });
    } catch (err: any) {
      expect(err.stdout || err.stderr).toMatch(/Invalid GitHub URL format/i);
      return;
    }
    throw new Error('Expected CLI to exit with an error');
  });

  it('should generate a health report file for a valid GitHub URL', () => {
    jest.mock('axios', () => ({
      default: {
        get: jest.fn().mockResolvedValue({ data: { mock: true } }),
      },
    }));

    execSync(
      `npx ts-node ${scriptPath} analyze https://github.com/octocat/Hello-World`,
      { encoding: 'utf-8' },
    );

    expect(fs.existsSync(reportPath)).toBe(true);

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    expect(report.repo || report.name).toBeDefined();
  });
});
