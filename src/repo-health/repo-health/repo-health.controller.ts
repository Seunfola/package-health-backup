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
import {
  AnalyzeRepoDto,
  AnalyzeUrlDto,
  AnalyzePrivateRepoDto,
  AnalyzePrivateUrlDto,
} from './repo-health.dto';

@ApiTags('repo-health')
@Controller('repo-health')
export class RepoHealthController {
  constructor(
    private readonly repoHealthService: RepoHealthService,
    private readonly githubApiService: GithubApiService,
    private readonly dependencyAnalysisService: DependencyAnalysisService,
  ) {}


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
  async analyzePublicRepo(@Body() body: AnalyzeRepoDto) {
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
        undefined, // file
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
  async analyzePublicRepoByUrl(@Body() body: AnalyzeUrlDto) {
    const { url, token, packageJson } = body;

    if (!url) {
      throw new HttpException('GitHub URL is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const rawJson = packageJson ? JSON.parse(packageJson) : undefined;
      return await this.repoHealthService.analyzePublicRepoByUrl(
        url,
        undefined, // file
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
  async analyzePrivateRepo(@Body() body: AnalyzePrivateRepoDto) {
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
        undefined, // file
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
  async analyzePrivateRepoByUrl(@Body() body: AnalyzePrivateUrlDto) {
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
        undefined, // file
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
  async analyzeRepoAuto(@Body() body: AnalyzeRepoDto) {
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
        undefined, // file
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
  async analyzeByUrlAuto(@Body() body: AnalyzeUrlDto) {
    const { url, token, packageJson } = body;

    if (!url) {
      throw new HttpException('GitHub URL is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const rawJson = packageJson ? JSON.parse(packageJson) : undefined;
      return await this.repoHealthService.analyzeByUrlAuto(
        url,
        undefined, // file
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
      },
      required: ['file'],
    },
  })
  async analyzeDependenciesFromFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.dependencyAnalysisService.analyzeDependencies(file);
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
      },
      required: ['json'],
    },
  })
  async analyzeDependenciesFromJson(@Body('json') json: string) {
    if (!json) {
      throw new HttpException('No JSON provided', HttpStatus.BAD_REQUEST);
    }

    try {
      const rawJson = JSON.parse(json);
      return await this.dependencyAnalysisService.analyzeDependencies(
        undefined,
        rawJson,
      );
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
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  async searchRepos(
    @Query('owner') owner?: string,
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

  @Post('analyze')
  @ApiOperation({
    summary: 'Analyze repository (legacy endpoint)',
    description:
      'Legacy endpoint for backward compatibility. Uses auto-detection.',
  })
  async analyzeRepoLegacy(@Body() body: AnalyzeRepoDto) {
    return this.analyzeRepoAuto(body);
  }

  @Post('analyze-url')
  @ApiOperation({
    summary: 'Analyze repository by URL (legacy endpoint)',
    description:
      'Legacy endpoint for backward compatibility. Uses auto-detection.',
  })
  async analyzeByUrlLegacy(@Body() body: AnalyzeUrlDto) {
    return this.analyzeByUrlAuto(body);
  }
}
