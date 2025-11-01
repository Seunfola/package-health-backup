import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as fs from 'node:fs';
import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';

// Import your actual services - adjust paths based on your project structure
import { RepoHealthService } from '../repo-health/services/repo-health.service';
import { GithubApiService } from '../repo-health/services/github-api.service';
import { DependencyAnalysisService } from '../repo-health/services/dependency-analysis.service';
import { HealthCalculatorService } from '../repo-health/services/health-calculator.service';
import { RepositoryDataService } from '../repo-health/services/repository-data.service';
import { DependencyAnalyzerService } from '../repo-health/dependency-analyzer.service';

interface CLIArgs {
  url: string;
  token?: string;
}

// Mock model for CLI context
class MockRepoHealthModel {
  async findOne() {
    return null;
  }
  async create(data: any) {
    return data;
  }
  async findOneAndUpdate() {
    return null;
  }
}

async function main() {
  try {
    const argv = await yargs(hideBin(process.argv))
      .command<CLIArgs>('analyze <url>', 'Analyze a GitHub repository', (y) =>
        y.positional('url', { type: 'string', demandOption: true }),
      )
      .option('token', { type: 'string', describe: 'GitHub access token' })
      .strict()
      .help()
      .parseAsync();

    const { url, token } = argv;

    if (!url) throw new Error('URL is required');
    if (typeof url !== 'string') throw new Error('URL must be a string');

    const githubMatch = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!githubMatch) throw new Error('Invalid GitHub URL format.');

    const [, owner, repo] = githubMatch;

    const logger = new Logger('RepoHealthCLI');

    // Initialize services
    const httpService = new HttpService();
    const githubApiService = new GithubApiService(httpService);

    const dependencyAnalyzer = new DependencyAnalyzerService();
    const dependencyAnalysisService = new DependencyAnalysisService(
      dependencyAnalyzer,
    );

    const healthCalculatorService = new HealthCalculatorService();

    // Use mock model for CLI context
    const repositoryDataService = new RepositoryDataService(
      new MockRepoHealthModel() as any,
    );

    const repoHealthService = new RepoHealthService(
      githubApiService,
      dependencyAnalysisService,
      healthCalculatorService,
      repositoryDataService,
    );

    console.log(`📊 Starting analysis for ${owner}/${repo} ...`);

    const result = await repoHealthService.analyzeRepositoryAuto(
      owner,
      repo,
      undefined,
      undefined,
      token,
    );

    // Save report
    const reportFilename = `health-report-${owner}-${repo}-${Date.now()}.json`;
    fs.writeFileSync(reportFilename, JSON.stringify(result, null, 2));

    console.log('\n✅ Analysis Complete!\n');
    console.log(`📄 Report saved to: ${reportFilename}`);
    console.log(
      `🏆 Overall Health: ${result.overall_health?.score}/100 (${result.overall_health?.label})`,
    );
    console.log(`📦 Dependency Health: ${result.dependency_health}/100`);

    return result;
  } catch (error) {
    console.error(
      '\n❌ Error:',
      error instanceof Error ? error.message : 'Unknown error occurred.',
    );
    process.exit(1);
  }
}

// Export for testing
export { main };

void main();
