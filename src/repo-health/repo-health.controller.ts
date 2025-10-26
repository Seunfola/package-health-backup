import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiConsumes,
  ApiQuery,
} from '@nestjs/swagger';
import { RepoHealthService } from './services/repo-health.service';
import {
  AnalyzeAutoRepoDto,
  AnalyzeWithPasteJsonDto,
  AnalyzeLegacyUrlDto,
  AnalyzeLegacyRepoDto,
} from './repo-health.dto';

@ApiTags('repo-health')
@Controller('repo-health')
export class RepoHealthController {
  constructor(private readonly repoHealthService: RepoHealthService) {}

  @Post('analyze/url')
  @ApiOperation({
    summary: 'Analyze repository by URL',
    description:
      'Auto-detects public/private. Token required for private repos.',
  })
  @ApiBody({ type: AnalyzeAutoRepoDto })
  async analyzeByUrl(@Body() body: AnalyzeAutoRepoDto) {
    const { url, token } = body;

    if (!url) {
      throw new HttpException('GitHub URL is required', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.repoHealthService.analyzeByUrlAuto(
        url,
        undefined,
        undefined,
        token,
      );
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      const message =
        err instanceof Error ? err.message : 'Unexpected error occurred';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('analyze/repo')
  @ApiOperation({
    summary: 'Analyze repository by owner and name',
    description:
      'Auto-detects public/private. Token required for private repos.',
  })
  @ApiBody({ type: AnalyzeLegacyRepoDto })
  async analyzeByRepo(@Body() body: AnalyzeLegacyRepoDto) {
    const { owner, repo, token } = body;

    if (!owner || !repo) {
      throw new HttpException(
        'Both owner and repo are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.repoHealthService.analyzeRepositoryAuto(
        owner,
        repo,
        undefined,
        undefined,
        token,
      );
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      const message =
        err instanceof Error ? err.message : 'Unexpected error occurred';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('analyze/with-json')
  @ApiOperation({
    summary: 'Analyze repository with package.json content',
    description:
      'Auto-detects public/private. Token required for private repos.',
  })
  @ApiBody({ type: AnalyzeWithPasteJsonDto })
  async analyzeWithJson(@Body() body: AnalyzeWithPasteJsonDto) {
    const { url, token, packageJson } = body;

    if (!url) {
      throw new HttpException('GitHub URL is required', HttpStatus.BAD_REQUEST);
    }

    if (!packageJson) {
      throw new HttpException(
        'Package.json content is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      let rawJson;
      try {
        rawJson = JSON.parse(packageJson);
      } catch (parseErr) {
        throw new HttpException(
          'Invalid JSON format in package.json content',
          HttpStatus.BAD_REQUEST,
        );
      }
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

  @Post('analyze/with-upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Analyze repository with uploaded package.json file',
    description:
      'Auto-detects public/private. Token required for private repos.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          example: 'https://github.com/nestjs/nest',
          description: 'GitHub repository URL',
        },
        token: {
          type: 'string',
          example: 'ghp_xxx',
          description: 'GitHub token (optional)',
        },
        file: {
          type: 'string',
          format: 'binary',
          description: 'package.json file to upload',
        },
      },
      required: ['url', 'file'],
    },
  })
  async analyzeWithUpload(
    @Body('url') url: string,
    @Body('token') token: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!url) {
      throw new HttpException('GitHub URL is required', HttpStatus.BAD_REQUEST);
    }

    if (!file) {
      throw new HttpException('File is required', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.repoHealthService.analyzeByUrlAuto(
        url,
        file,
        undefined,
        token,
      );
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      const message =
        err instanceof Error ? err.message : 'Unexpected error occurred';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('dependencies/json')
  @ApiOperation({
    summary: 'Analyze dependencies from JSON content',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        json: {
          type: 'string',
          example: '{"dependencies": {"express": "^4.18.0"}}',
          description: 'Raw package.json content',
        },
      },
      required: ['json'],
    },
  })
  async analyzeDependenciesFromJson(@Body('json') json: string) {
    if (!json) {
      throw new HttpException(
        'JSON content is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const rawJson = JSON.parse(json);
      return await this.repoHealthService.processDependencies(
        undefined,
        rawJson,
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Invalid JSON format';
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('dependencies/upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Analyze dependencies from uploaded file',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'package.json or package-lock.json file',
        },
      },
      required: ['file'],
    },
  })
  async analyzeDependenciesFromFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new HttpException('File is required', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.repoHealthService.processDependencies(file);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to analyze dependencies';
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('repo/:owner/:repo')
  @ApiOperation({
    summary: 'Get stored repository health analysis',
  })
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
        err instanceof Error
          ? err.message
          : 'Failed to fetch repository health';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('owner/:owner')
  @ApiOperation({
    summary: 'Get all repositories by owner',
  })
  async getReposByOwner(@Param('owner') owner: string) {
    if (!owner) {
      throw new HttpException('Owner is required', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.repoHealthService.findByOwner(owner);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch repositories';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search repositories',
  })
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
        err instanceof Error ? err.message : 'Failed to search repositories';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('analyze')
  @ApiOperation({
    summary: 'Analyze repository (legacy endpoint)',
    description: 'Legacy endpoint for backward compatibility',
  })
  @ApiBody({ type: AnalyzeLegacyRepoDto })
  async analyzeLegacy(@Body() body: AnalyzeLegacyRepoDto) {
    return this.analyzeByRepo(body);
  }

  @Post('analyze-url')
  @ApiOperation({
    summary: 'Analyze repository by URL (legacy endpoint)',
    description: 'Legacy endpoint for backward compatibility',
  })
  @ApiBody({ type: AnalyzeLegacyUrlDto })
  async analyzeUrlLegacy(@Body() body: AnalyzeLegacyUrlDto) {
    return this.analyzeByUrl(body);
  }
}
