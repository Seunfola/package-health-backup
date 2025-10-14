import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { RepoHealthService } from './repo-health.service';

@ApiTags('repo-health')
@Controller('repo-health')
export class RepoHealthController {
  constructor(private readonly repoHealthService: RepoHealthService) {}

  /** 🔍 Full repo analysis: GitHub URL + optional package.json */
  @Post('analyze-full')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary:
      'Analyze GitHub repository + optional package.json (upload or paste)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', example: 'https://github.com/nestjs/nest' },
        file: {
          type: 'string',
          format: 'binary',
          description: 'Optional package.json file',
        },
        json: {
          type: 'string',
          description: 'Optional pasted package.json content',
        },
      },
      required: ['url'],
    },
  })
  async analyzeFullRepo(
    @Body('url') url: string,
    @UploadedFile() file?: Express.Multer.File,
    @Body('json') json?: string,
  ) {
    if (!url) {
      throw new HttpException('GitHub URL is required', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.repoHealthService.analyzeByUrl(url, file, json);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Unexpected error occurred';
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

  /** 📦 Analyze uploaded package.json only (dependency analysis) */
  @Post('analyze-package/upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Analyze uploaded package.json file' })
  async analyzeUploadedPackage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.repoHealthService.analyzePackageJson(file);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Unexpected error occurred';
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

  /** 🧾 Analyze pasted package.json only (dependency analysis) */
  @Post('analyze-package/paste')
  @ApiOperation({ summary: 'Analyze pasted package.json content' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        json: {
          type: 'string',
          description: 'Raw package.json content as text',
          example: `{
            "name": "my-app",
            "dependencies": {
              "react": "^18.2.0",
              "nestjs": "^10.0.0"
            }
          }`,
        },
      },
      required: ['json'],
    },
  })
  async analyzePastedPackage(@Body('json') json: string) {
    if (!json) {
      throw new HttpException('No JSON provided', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.repoHealthService.analyzePackageJson(undefined, json);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Unexpected error occurred';
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

  /** 🔎 Fetch stored repo health from DB */
  @Post('fetch')
  @ApiOperation({ summary: 'Fetch stored repository health info' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', example: 'nestjs' },
        repo: { type: 'string', example: 'nest' },
      },
      required: ['owner', 'repo'],
    },
  })
  async fetchStoredRepo(@Body() body: { owner: string; repo: string }) {
    const { owner, repo } = body;
    if (!owner || !repo) {
      throw new HttpException(
        'Both owner and repo are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.repoHealthService.findRepoHealth(owner, repo);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Unexpected error occurred';
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }
}
