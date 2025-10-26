// repo-health.controller.ts
import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { RepoHealthService } from './services/repo-health.service';
import {
  AnalyzePublicRepoDto,
  AnalyzePrivateRepoDto,
  AnalyzePublicUrlDto,
  AnalyzePrivateUrlDto,
  AnalyzeAutoRepoDto,
  AnalyzeAutoUrlDto,
} from './repo-health.dto';

@ApiTags('repo-health')
@Controller('repo-health')
export class RepoHealthController {
  constructor(private readonly repoHealthService: RepoHealthService) {}

  @Post('public/repo')
  @ApiOperation({
    summary: 'Analyze PUBLIC repository by owner/repo',
    description: 'No token required for public repositories',
  })
  @ApiBody({ type: AnalyzePublicRepoDto })
  async analyzePublicRepo(@Body() body: AnalyzePublicRepoDto) {
    const { owner, repo, packageJson } = body;

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
    summary: 'Analyze PUBLIC repository by URL',
    description: 'No token required for public repositories',
  })
  @ApiBody({ type: AnalyzePublicUrlDto })
  async analyzePublicRepoByUrl(@Body() body: AnalyzePublicUrlDto) {
    const { url, packageJson } = body;

    if (!url) {
      throw new HttpException('GitHub URL is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const rawJson = packageJson ? JSON.parse(packageJson) : undefined;
      return await this.repoHealthService.analyzePublicRepoByUrl(
        url,
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

  @Post('private/repo')
  @ApiOperation({
    summary: 'Analyze PRIVATE repository by owner/repo',
    description: 'Token is REQUIRED for private repositories',
  })
  @ApiBody({ type: AnalyzePrivateRepoDto })
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
        token, // required
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
    summary: 'Analyze PRIVATE repository by URL',
    description: 'Token is REQUIRED for private repositories',
  })
  @ApiBody({ type: AnalyzePrivateUrlDto })
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
        token, // required
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
    summary: 'Auto-detect repository type and analyze',
    description: 'Token is required only if repository is private',
  })
  @ApiBody({
    type: AnalyzeAutoRepoDto,
    description: 'Auto-detect repository visibility and analyze accordingly',
  })
  async analyzeRepoAuto(@Body() body: AnalyzeAutoRepoDto) {
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
    summary: 'Auto-detect repository type by URL and analyze',
    description: 'Token is required only if repository is private',
  })
  @ApiBody({
    type: AnalyzeAutoUrlDto,
    description:
      'Auto-detect repository visibility from URL and analyze accordingly',
  })
  async analyzeByUrlAuto(@Body() body: AnalyzeAutoUrlDto) {
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


  @Post('analyze')
  @ApiOperation({
    summary: 'Analyze repository (legacy endpoint)',
    description:
      'Legacy endpoint for backward compatibility. Uses auto-detection.',
  })
  @ApiBody({ type: AnalyzeAutoRepoDto })
  async analyzeRepoLegacy(@Body() body: AnalyzeAutoRepoDto) {
    return this.analyzeRepoAuto(body);
  }

  @Post('analyze-url')
  @ApiOperation({
    summary: 'Analyze repository by URL (legacy endpoint)',
    description:
      'Legacy endpoint for backward compatibility. Uses auto-detection.',
  })
  @ApiBody({ type: AnalyzeAutoUrlDto })
  async analyzeByUrlLegacy(@Body() body: AnalyzeAutoUrlDto) {
    return this.analyzeByUrlAuto(body);
  }
}
