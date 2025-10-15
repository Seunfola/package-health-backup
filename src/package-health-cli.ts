import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { RepoHealthService } from './index';
import { DependencyAnalyzerService } from './index';
import { HttpService } from '@nestjs/axios';
import { Model } from 'mongoose';
import { RepoHealthDocument } from './repo-health/repo-health/repo-health.model';

interface CLIArgs {
  url: string;
}

async function main() {
  try {
    // Parse CLI arguments
    const argv = await yargs(hideBin(process.argv))
      .command<CLIArgs>('analyze <url>', 'Analyze a GitHub repo', (y) =>
        y.positional('url', {
          type: 'string',
          demandOption: true,
          describe: 'GitHub repository URL',
        }),
      )
      .strict()
      .help()
      .parseAsync();

    if (!argv.url) {
      console.error('A required string argument <url> was not provided.');
      process.exit(1);
    }

    const url = argv.url;

    // Minimal mock for Mongoose Model
    // Minimal mockModel with signatures compatible with Mongoose Model for testing
    const mockModel: Partial<Model<RepoHealthDocument>> = {
      findOne: () =>
        ({
          exec: async (): Promise<RepoHealthDocument | null> => null,
          // Provide mock then/catch so the shape is acceptable for Mongoose's Query
          then: undefined,
          catch: undefined,
        }) as unknown, // Type assertion to satisfy Query type requirements// Type assertion to satisfy Query type requirements
      findOneAndUpdate: () =>
        ({
          exec: async (): Promise<RepoHealthDocument | null> => null,
          then: undefined,
          catch: undefined,
        }),
    };

    // Instantiate RepoHealthService
    const repoHealthService = new RepoHealthService(
      mockModel as Model<RepoHealthDocument>,
      new HttpService(),
      new DependencyAnalyzerService(),
    );

    // Run analysis
    const result = await repoHealthService.analyzeByUrl(url);
    console.log(JSON.stringify(result, null, 2));
  } catch (err: unknown) {
    console.error(
      'Error:',
      err instanceof Error ? err.message : JSON.stringify(err),
    );
    process.exit(1);
  }
}

void main();
