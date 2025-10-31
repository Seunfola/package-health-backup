import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as fs from 'node:fs';
import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import { DependencyAnalyzerService } from 'src/repo-health/dependency-analyzer.service';
import { DependencyAnalysisService } from 'src/repo-health/services/dependency-analysis.service';
import { RepoHealthService } from 'src/repo-health/services/repo-health.service';
import { GithubApiService } from 'src/repo-health/services/github-api.service';
import { HealthCalculatorService } from 'src/repo-health/services/health-calculator.service';
import { RepositoryDataService } from 'src/repo-health/services/repository-data.service';
import type { Model } from 'mongoose';
import { RepoHealthDocument } from 'src/repo-health/repo-health.model';

interface CLIArgs {
  url: string;
  token?: string;
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

    const githubMatch = typeof url === 'string'
      ? url.match(/github\.com\/([^/]+)\/([^/]+)/)
      : null;
    if (!githubMatch) throw new Error('Invalid GitHub URL format.');

    const [, owner, repo] = githubMatch;

    const logger = new Logger('RepoHealthCLI');
    const httpService = new HttpService();

    const dependencyAnalyzer = new DependencyAnalyzerService();
    const dependencyAnalysisService = new DependencyAnalysisService(dependencyAnalyzer);

    const healthCalculatorService = new HealthCalculatorService();
    // For CLI, we skip dependency injection; use undefined/mock as model for data service
    const repositoryDataService = new RepositoryDataService(undefined as unknown as Model<RepoHealthDocument>);
    const githubApiService = new GithubApiService(httpService);

    const repoHealthService = new RepoHealthService(
      githubApiService,
      dependencyAnalysisService,
      healthCalculatorService,
      repositoryDataService,
    );

    console.log(`Starting analysis for ${owner}/${repo} ...`);
    const result = await repoHealthService.analyzeRepositoryAuto(
      owner,
      repo,
      undefined,
      undefined,
      token,
    );

    fs.writeFileSync('health-report.json', JSON.stringify(result, null, 2));
    console.log('\n✅ Analysis Result:\n');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(
      '\n❌ Error:',
      error instanceof Error ? error.message : 'Unknown error occurred.',
    );
    process.exit(1);
  }
}

void main();
