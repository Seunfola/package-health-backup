import {
  Controller,
  Post,
  Get,
  Body,
  UploadedFile,
  UseInterceptors,
  HttpException,
  HttpStatus,
  Param,
  Query,
  Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { RepoHealthService } from './services/repo-health.service';
import { GithubApiService } from './services/github-api.service';
import { DependencyAnalysisService } from './services/dependency-analysis.service';

interface UrlBody {
  url: string;
  token?: string;
}

interface OwnerRepoBody {
  owner: string;
  repo: string;
}

interface AnalyzeBody {
  owner: string;
  repo: string;
  token?: string;
  packageJson?: string;
}

@ApiTags('repo-health')
@Controller('repo-health')
export class RepoHealthController {
  constructor(
    private readonly repoHealthService: RepoHealthService,
    private readonly githubApiService: GithubApiService,
    private readonly dependencyAnalysisService: DependencyAnalysisService,
  ) {}

  // ==================== PUBLIC REPOSITORY ANALYSIS ====================

  @Post('public/repo')
  @ApiOperation({
    summary: 'Analyze public repository by owner and repo name',
    description:
      'Analyze a public GitHub repository. Token is optional for rate limiting.',
  })
  @ApiResponse({
    status: 200,
    description: 'Public repository analysis completed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or repository not found',
  })
  async analyzePublicRepo(@Body() body: AnalyzeBody) {
    const { owner, repo, token, packageJson } = body;

    if (!owner || !repo) {
      throw new HttpException(
        'Both owner and repo are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const rawJson = packageJson ? JSON.parse(packageJson) : undefined;
      return await this.repoHealthService.analyzePublicRepository(
        owner,
        repo,
        undefined,
        rawJson,
        token,
      );
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      const message =
        err instanceof Error ? err.message : 'Unexpected error occurred';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('public/url')
  @ApiOperation({
    summary: 'Analyze public repository by GitHub URL',
    description:
      'Analyze a public GitHub repository using its URL. Token is optional for rate limiting.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', example: 'https://github.com/nestjs/nest' },
        token: {
          type: 'string',
          example: 'ghp_xxx',
          description: 'Optional GitHub token for rate limiting',
        },
        packageJson: {
          type: 'string',
          description: 'Optional package.json content as string',
        },
      },
      required: ['url'],
    },
  })
  async analyzePublicRepoByUrl(
    @Body() body: UrlBody & { packageJson?: string },
  ) {
    const { url, token, packageJson } = body;

    if (!url) {
      throw new HttpException('GitHub URL is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const rawJson = packageJson ? JSON.parse(packageJson) : undefined;
      return await this.repoHealthService.analyzePublicRepoByUrl(
        url,
        undefined,
        rawJson,
        token,
      );
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      const message =
        err instanceof Error ? err.message : 'Unexpected error occurred';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('private/repo')
  @ApiOperation({
    summary: 'Analyze private repository by owner and repo name',
    description: 'Analyze a private GitHub repository. Token is required.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', example: 'your-username' },
        repo: { type: 'string', example: 'your-private-repo' },
        token: {
          type: 'string',
          example: 'ghp_xxx',
          description: 'GitHub token (required)',
        },
        packageJson: {
          type: 'string',
          description: 'Optional package.json content as string',
        },
      },
      required: ['owner', 'repo', 'token'],
    },
  })
  async analyzePrivateRepo(@Body() body: AnalyzeBody & { token: string }) {
    const { owner, repo, token, packageJson } = body;

    if (!owner || !repo || !token) {
      throw new HttpException(
        'Owner, repo, and token are required for private repositories',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const rawJson = packageJson ? JSON.parse(packageJson) : undefined;
      return await this.repoHealthService.analyzePrivateRepository(
        owner,
        repo,
        token,
        undefined,
        rawJson,
      );
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      const message =
        err instanceof Error ? err.message : 'Unexpected error occurred';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('private/url')
  @ApiOperation({
    summary: 'Analyze private repository by GitHub URL',
    description:
      'Analyze a private GitHub repository using its URL. Token is required.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          example: 'https://github.com/username/private-repo',
        },
        token: {
          type: 'string',
          example: 'ghp_xxx',
          description: 'GitHub token (required)',
        },
        packageJson: {
          type: 'string',
          description: 'Optional package.json content as string',
        },
      },
      required: ['url', 'token'],
    },
  })
  async analyzePrivateRepoByUrl(
    @Body() body: UrlBody & { token: string; packageJson?: string },
  ) {
    const { url, token, packageJson } = body;

    if (!url || !token) {
      throw new HttpException(
        'URL and token are required for private repositories',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const rawJson = packageJson ? JSON.parse(packageJson) : undefined;
      return await this.repoHealthService.analyzePrivateRepoByUrl(
        url,
        token,
        undefined,
        rawJson,
      );
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      const message =
        err instanceof Error ? err.message : 'Unexpected error occurred';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('analyze/auto')
  @ApiOperation({
    summary: 'Analyze repository with auto-detection',
    description:
      'Automatically detect if repository is public or private and analyze accordingly.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', example: 'nestjs' },
        repo: { type: 'string', example: 'nest' },
        token: {
          type: 'string',
          example: 'ghp_xxx',
          description: 'Optional token (required for private repos)',
        },
        packageJson: {
          type: 'string',
          description: 'Optional package.json content as string',
        },
      },
      required: ['owner', 'repo'],
    },
  })
  async analyzeRepoAuto(@Body() body: AnalyzeBody) {
    const { owner, repo, token, packageJson } = body;

    if (!owner || !repo) {
      throw new HttpException(
        'Both owner and repo are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const rawJson = packageJson ? JSON.parse(packageJson) : undefined;
      return await this.repoHealthService.analyzeRepositoryAuto(
        owner,
        repo,
        undefined,
        rawJson,
        token,
      );
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      const message =
        err instanceof Error ? err.message : 'Unexpected error occurred';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('analyze/url-auto')
  @ApiOperation({
    summary: 'Analyze repository by URL with auto-detection',
    description:
      'Automatically detect repository visibility and analyze using URL.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', example: 'https://github.com/nestjs/nest' },
        token: {
          type: 'string',
          example: 'ghp_xxx',
          description: 'Optional token (required for private repos)',
        },
        packageJson: {
          type: 'string',
          description: 'Optional package.json content as string',
        },
      },
      required: ['url'],
    },
  })
  async analyzeByUrlAuto(@Body() body: UrlBody & { packageJson?: string }) {
    const { url, token, packageJson } = body;

    if (!url) {
      throw new HttpException('GitHub URL is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const rawJson = packageJson ? JSON.parse(packageJson) : undefined;
      return await this.repoHealthService.analyzeByUrlAuto(
        url,
        undefined,
        rawJson,
        token,
      );
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      const message =
        err instanceof Error ? err.message : 'Unexpected error occurred';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('visibility/check')
  @ApiOperation({
    summary: 'Check repository visibility',
    description: 'Determine if a repository is public or private.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', example: 'https://github.com/nestjs/nest' },
        token: {
          type: 'string',
          example: 'ghp_xxx',
          description: 'Optional token for private repository verification',
        },
      },
      required: ['url'],
    },
  })
  async checkVisibility(@Body() body: UrlBody) {
    const { url, token } = body;

    if (!url) {
      throw new HttpException('GitHub URL is required', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.repoHealthService.checkRepoVisibility(url, token);
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      const message =
        err instanceof Error ? err.message : 'Unexpected error occurred';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('debug-visibility')
  @ApiOperation({
    summary: 'Debug repository visibility detection',
    description:
      'Get detailed information about repository visibility detection.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', example: 'https://github.com/nestjs/nest' },
        token: { type: 'string', example: 'ghp_xxx' },
      },
      required: ['url'],
    },
  })
  async debugVisibility(@Body() body: UrlBody) {
    const { url, token } = body;

    if (!url) {
      throw new HttpException('GitHub URL is required', HttpStatus.BAD_REQUEST);
    }

    try {
      // This method should be added to the service for detailed debugging
      return await this.repoHealthService['debugRepoVisibility'](url, token);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('dependencies/upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Analyze dependencies from uploaded file',
    description:
      'Analyze package.json, package-lock.json, or zipped project folder',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        analyzeHealth: {
          type: 'boolean',
          description: 'Whether to perform full health analysis',
        },
      },
      required: ['file'],
    },
  })
  async analyzeDependenciesFromFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('analyzeHealth') analyzeHealth?: boolean,
  ) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    try {
      const analysis =
        await this.dependencyAnalysisService.analyzeDependencies(file);

      if (analyzeHealth) {
        // Perform additional health analysis if requested
        const healthScore = this.repoHealthService.calculateHealthScore(
          {} as any, // Mock repo data
          [], // Mock commit activity
          [], // Mock security alerts
          analysis.dependencyHealth,
        );

        return {
          ...analysis,
          healthScore,
        };
      }

      return analysis;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('dependencies/json')
  @ApiOperation({ summary: 'Analyze dependencies from JSON content' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        json: { type: 'string', description: 'Raw package.json content' },
        analyzeHealth: {
          type: 'boolean',
          description: 'Whether to perform full health analysis',
        },
      },
      required: ['json'],
    },
  })
  async analyzeDependenciesFromJson(
    @Body('json') json: string,
    @Body('analyzeHealth') analyzeHealth?: boolean,
  ) {
    if (!json) {
      throw new HttpException('No JSON provided', HttpStatus.BAD_REQUEST);
    }

    try {
      const rawJson = JSON.parse(json);
      const analysis = await this.dependencyAnalysisService.analyzeDependencies(
        undefined,
        rawJson,
      );

      if (analyzeHealth) {
        const healthScore = this.repoHealthService.calculateHealthScore(
          {} as any,
          [],
          [],
          analysis.dependencyHealth,
        );

        return {
          ...analysis,
          healthScore,
        };
      }

      return analysis;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('repo/:owner/:repo')
  @ApiOperation({ summary: 'Get stored repository health analysis' })
  async getRepoHealth(
    @Param('owner') owner: string,
    @Param('repo') repo: string,
  ) {
    if (!owner || !repo) {
      throw new HttpException(
        'Both owner and repo are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const repoId = `${owner}/${repo}`;
      const health = await this.repoHealthService.findOne(repoId);

      if (!health) {
        throw new HttpException(
          'Repository analysis not found',
          HttpStatus.NOT_FOUND,
        );
      }

      return health;
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      const message =
        err instanceof Error ? err.message : 'Unexpected error occurred';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('search')
  @ApiOperation({ summary: 'Search repositories' })
  @ApiQuery({ name: 'owner', required: false, description: 'Filter by owner' })
  @ApiQuery({
    name: 'minHealth',
    required: false,
    description: 'Minimum health score',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  async searchRepos(
    @Query('owner') owner?: string,
    @Query('minHealth') minHealth?: number,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    try {
      return await this.repoHealthService.findAll(page, limit);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unexpected error occurred';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('owner/:owner')
  @ApiOperation({ summary: 'Get all repositories by owner' })
  async getReposByOwner(@Param('owner') owner: string) {
    if (!owner) {
      throw new HttpException('Owner is required', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.repoHealthService.findByOwner(owner);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unexpected error occurred';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get repository health statistics' })
  async getStats() {
    try {
      return await this.repoHealthService.getStats();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unexpected error occurred';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('repo/:owner/:repo')
  @ApiOperation({ summary: 'Delete repository analysis' })
  async deleteRepoAnalysis(
    @Param('owner') owner: string,
    @Param('repo') repo: string,
  ) {
    if (!owner || !repo) {
      throw new HttpException(
        'Both owner and repo are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const repoId = `${owner}/${repo}`;
      const deleted = await this.repoHealthService['deleteRepo'](repoId);

      if (!deleted) {
        throw new HttpException(
          'Repository analysis not found',
          HttpStatus.NOT_FOUND,
        );
      }

      return { message: 'Repository analysis deleted successfully' };
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      const message =
        err instanceof Error ? err.message : 'Unexpected error occurred';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('analyze')
  @ApiOperation({
    summary: 'Analyze repository (legacy endpoint)',
    description:
      'Legacy endpoint for backward compatibility. Uses auto-detection.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', example: 'nestjs' },
        repo: { type: 'string', example: 'nest' },
        token: { type: 'string', example: 'ghp_xxx' },
        packageJson: { type: 'string' },
      },
      required: ['owner', 'repo'],
    },
  })
  async analyzeRepoLegacy(@Body() body: AnalyzeBody) {
    return this.analyzeRepoAuto(body);
  }

  @Post('analyze-url')
  @ApiOperation({
    summary: 'Analyze repository by URL (legacy endpoint)',
    description:
      'Legacy endpoint for backward compatibility. Uses auto-detection.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', example: 'https://github.com/nestjs/nest' },
        token: { type: 'string', example: 'ghp_xxx' },
        packageJson: { type: 'string' },
      },
      required: ['url'],
    },
  })
  async analyzeByUrlLegacy(@Body() body: UrlBody & { packageJson?: string }) {
    return this.analyzeByUrlAuto(body);
  }
}
