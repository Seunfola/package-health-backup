import { main } from '../package-health';
import * as fs from 'fs';

// Mock the dependencies
jest.mock('@nestjs/axios');
jest.mock('@nestjs/common');
jest.mock('../repo-health/services/repo-health.service');
jest.mock('../repo-health/services/github-api.service');
jest.mock('../repo-health/services/dependency-analysis.service');
jest.mock('../repo-health/services/health-calculator.service');
jest.mock('../repo-health/services/repository-data.service');
jest.mock('../repo-health/dependency-analyzer.service');

describe('Package Health CLI Mock Tests', () => {
  const originalArgv = process.argv;
  const originalExit = process.exit;
  const originalConsole = console.log;
  const mockExit = jest.fn();

  beforeEach(() => {
    process.exit = mockExit as any;
    console.log = jest.fn();
    // Clean up any report files
    const files = fs.readdirSync('.');
    files.forEach((file) => {
      if (file.startsWith('health-report-') && file.endsWith('.json')) {
        fs.unlinkSync(file);
      }
    });
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.exit = originalExit;
    console.log = originalConsole;
    jest.clearAllMocks();
  });

  function setArgv(...args: string[]) {
    process.argv = ['node', 'package-health.ts', ...args];
  }

  it('should handle missing URL parameter', async () => {
    setArgv('analyze');

    await main();

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Error:'),
      expect.stringContaining('URL is required'),
    );
  });

  it('should handle invalid URL format', async () => {
    setArgv('analyze', 'invalid-url');

    await main();

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Error:'),
      expect.stringContaining('Invalid GitHub URL format'),
    );
  });

  it('should process valid GitHub URL', async () => {
    setArgv('analyze', 'https://github.com/octocat/Hello-World');

    await main();

    // Check if report file was created
    const files = fs.readdirSync('.');
    const reportFiles = files.filter(
      (f) => f.startsWith('health-report-') && f.endsWith('.json'),
    );
    expect(reportFiles.length).toBeGreaterThan(0);
  });
});
