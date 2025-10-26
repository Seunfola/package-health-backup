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
  AnalyzeRepoDto,
  AnalyzePrivateRepoDto,
  AnalyzeAutoRepoDto,
} from './repo-health.dto';

@ApiTags('repo-health')
@Controller('repo-health')
export class RepoHealthController {
  constructor(private readonly repoHealthService: RepoHealthService) {}

  @Post('public')
  @ApiOperation({
    summary: 'Analyze PUBLIC repository',
    description: 'No token required for public repositories',
  })
  @ApiBody({ type: AnalyzeRepoDto })
  async analyzePublicRepo(@Body() body: AnalyzeRepoDto) {
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

  @Post('private')
  @ApiOperation({
    summary: 'Analyze PRIVATE repository',
    description: 'Token is REQUIRED for private repositories',
  })
  @ApiBody({ type: AnalyzePrivateRepoDto })
  async analyzePrivateRepo(@Body() body: AnalyzePrivateRepoDto) {
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

  @Post('analyze')
  @ApiOperation({
    summary: 'Auto-detect repository type and analyze',
    description: 'Token is required only if repository is private',
  })
  @ApiBody({ type: AnalyzeAutoRepoDto })
  async analyzeRepoAuto(@Body() body: AnalyzeAutoRepoDto) {
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
}
