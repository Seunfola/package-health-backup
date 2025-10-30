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
  AnalyzeUrlDto,
  AnalyzePrivateUrlDto,
  AnalyzeWithJsonDto,
  AnalyzePrivateWithJsonDto,
} from './repo-health.dto';

@ApiTags('repo-health')
@Controller('repo-health')
export class RepoHealthController {
  constructor(private readonly repoHealthService: RepoHealthService) {}

  @Post('public')
  @ApiOperation({
    summary: 'Analyze PUBLIC repository by URL',
    description: 'URL only. No token required for public repositories.',
  })
  @ApiBody({ type: AnalyzeUrlDto })
  async analyzePublic(@Body() body: AnalyzeUrlDto) {
    try {
      return await this.repoHealthService.analyzeByUrl(body.url);
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      const message =
        err instanceof Error ? err.message : 'Unexpected error occurred';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('private')
  @ApiOperation({
    summary: 'Analyze PRIVATE repository by URL',
    description: 'URL and token required for private repositories.',
  })
  @ApiBody({ type: AnalyzePrivateUrlDto })
  async analyzePrivate(@Body() body: AnalyzePrivateUrlDto) {
    try {
      return await this.repoHealthService.analyzePrivateByUrl(
        body.url,
        body.token,
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
  async analyzeDependenciesFromJson(@Body('json') json: string): Promise<any> {
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
  async analyzeDependenciesFromFile(
    @UploadedFile() file: Express.Multer.File
  ): Promise<any> {
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
}
