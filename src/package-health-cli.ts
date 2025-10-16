#!/usr/bin/env ts-node
/* eslint-disable @typescript-eslint/no-unused-vars */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { HttpService } from '@nestjs/axios';
import { Model } from 'mongoose';
import { RepoHealthService } from './repo-health/repo-health/repo-health.service';
import { RepoHealthDocument } from './repo-health/repo-health/repo-health.model';
import { lastValueFrom } from 'rxjs';
import axios from 'axios';
import { DependencyAnalyzerService } from './repo-health/repo-health/dependency-analyzer.service';

interface CLIArgs {
  url: string;
  token?: string;
}

export const createMockModel = (): Model<RepoHealthDocument> => {
  const mockDoc: RepoHealthDocument = {
    _id: 'mock-id' as unknown,
    repo_id: 'mock/repo',
    owner: 'mock',
    repo: 'repo',
    name: 'mock-repo',
    stars: 0,
    forks: 0,
    open_issues: 0,
    last_pushed: new Date(),
    commit_activity: [],
    security_alerts: 0,
    dependency_health: 100,
    risky_dependencies: [],
    overall_health: { score: 100, label: 'Excellent' },
    toObject(this: RepoHealthDocument) {
      const { toObject, ...rest } = this as unknown as Record<string, unknown>;
      return { ...rest } as unknown as RepoHealthDocument;
    },
  } as unknown as RepoHealthDocument;

  const baseMock = {
    findOne: () => ({
      exec(): Promise<RepoHealthDocument | null> {
        return Promise.resolve(null);
      },
      lean(this: { exec: () => Promise<any> }) {
        return this;
      },
    }),

    findOneAndUpdate: () => ({
      exec(): Promise<RepoHealthDocument> {
        return Promise.resolve({ ...mockDoc } as unknown as RepoHealthDocument);
      },
      lean(this: { exec: () => Promise<any> }) {
        return this;
      },
    }),

    find: () => ({
      exec(): Promise<RepoHealthDocument[]> {
        return Promise.resolve([]);
      },
      lean(this: { exec: () => Promise<any> }) {
        return this;
      },
    }),

    create(): Promise<RepoHealthDocument> {
      return Promise.resolve({ ...mockDoc } as unknown as RepoHealthDocument);
    },

    updateOne() {
      return Promise.resolve({
        acknowledged: true,
        matchedCount: 0,
        modifiedCount: 0,
      });
    },

    deleteOne() {
      return Promise.resolve({
        acknowledged: true,
        deletedCount: 0,
      });
    },

    countDocuments(): Promise<number> {
      return Promise.resolve(0);
    },
  };

  return baseMock as unknown as Model<RepoHealthDocument>;
};

// --- Main CLI function ---
async function main() {
  try {
    const argv = await yargs(hideBin(process.argv))
      .command<CLIArgs>(
        'analyze <url>',
        'Analyze a GitHub repository for health metrics',
        (y) =>
          y.positional('url', {
            type: 'string',
            demandOption: true,
            describe:
              'GitHub repository URL (e.g. https://github.com/user/repo)',
          }),
      )
      .option('token', {
        type: 'string',
        describe: 'GitHub personal access token (for private repos)',
      })
      .strict()
      .help()
      .parseAsync();

    const { url, token } = argv;

    if (!url) {
      console.error('❌ Error: URL is required.');
      process.exit(1);
    }

    if (typeof url !== 'string') {
      console.error('❌ Error: URL must be a string.');
      process.exit(1);
    }

    const githubMatch = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!githubMatch) {
      console.error('❌ Error: Invalid GitHub URL format.');
      process.exit(1);
    }

    const [, owner, repo] = githubMatch;

    const mockModel = createMockModel();
    const httpService = new HttpService(axios);
    const dependencyAnalyzer = new DependencyAnalyzerService();

    const repoHealthService = new RepoHealthService(
      mockModel,
      httpService,
      dependencyAnalyzer,
    );

    console.log(`🚀 Starting analysis for ${owner}/${repo} ...`);

    // ✅ Just pass owner, repo, and token
    const result = await repoHealthService.analyzeRepo(
      owner,
      repo,
      undefined,
      undefined,
      token,
    );

    console.log('\n Analysis Result:\n');
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(
      '\n Error:',
      error instanceof Error ? error.message : 'Unknown error occurred.',
    );
    process.exit(1);
  }
}

void main();
