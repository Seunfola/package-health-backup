import { exec } from 'child_process';
import path from 'path';
import { RepoHealthService } from 'src/repo-health/repo-health/repo-health.service';

jest.mock('../src/repo-health/repo-health/repo-health.service');

describe('CLI Integration', () => {
  const cliPath = path.join(__dirname, '../src/cli.ts');
  const mockAnalyzeRepo = jest.fn();

  beforeAll(() => {
    (RepoHealthService as jest.Mock).mockImplementation(() => ({
      analyzeRepo: mockAnalyzeRepo,
    }));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const runCLI = (
    args: string[],
  ): Promise<{ stdout: string; stderr: string }> =>
    new Promise((resolve) => {
      exec(`ts-node ${cliPath} ${args.join(' ')}`, (error, stdout, stderr) => {
        resolve({ stdout, stderr });
      });
    });

  test('should error when URL is missing', async () => {
    const { stderr } = await runCLI(['analyze']);
    expect(stderr).toContain('URL is required');
  });

  test('should error when invalid GitHub URL is provided', async () => {
    const { stderr } = await runCLI(['analyze', 'invalid-url']);
    expect(stderr).toContain('Invalid GitHub URL');
  });

  test('should call analyzeRepo with owner/repo and token', async () => {
    mockAnalyzeRepo.mockResolvedValue({ overall_health: { score: 95 } });

    const { stdout } = await runCLI([
      'analyze',
      'https://github.com/testuser/testrepo',
      '--token=testtoken',
    ]);

    expect(mockAnalyzeRepo).toHaveBeenCalledWith(
      'testuser',
      'testrepo',
      undefined,
      undefined,
      'testtoken',
    );

    expect(stdout).toContain('Starting analysis for testuser/testrepo');
    expect(stdout).toContain('"score": 95');
  });
});
