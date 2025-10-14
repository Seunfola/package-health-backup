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

interface UrlBody {
  url: string;
  token?: string;
}

interface OwnerRepoBody {
  owner: string;
  repo: string;
}

@ApiTags('repo-health')
@Controller('repo-health')
export class RepoHealthController {
  constructor(private readonly repoHealthService: RepoHealthService) {}

  /** 🔍 Analyze GitHub repo by URL */
  @Post('analyze-url')
  @ApiOperation({ summary: 'Analyze a repository by GitHub URL' })
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
  async analyzeByUrl(@Body() body: UrlBody) {
    const { url, token } = body;
    if (!url) {
      throw new HttpException('GitHub URL is required', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.repoHealthService.analyzeByUrl(
        url,
        undefined,
        undefined,
        token,
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unexpected error occurred';
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('analyze-package/upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Analyze uploaded package.json, package-lock.json, or folder zip',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  async analyzeUploadedPackage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    try {
      // Extract dependencies from uploaded file (supports zip + single file)
      const deps = this.repoHealthService['_getDependenciesFromFile'](file);

      // Analyze dependencies locally (no GitHub API)
      const analysis = await this.repoHealthService.analyzeJson(
        JSON.stringify({ dependencies: deps }),
      );

      return {
        project_name: file.originalname,
        dependencies: deps,
        dependency_health: analysis.dependency_health,
        risky_dependencies: analysis.risky_dependencies,
        outdated_dependencies: analysis.outdated_dependencies,
        // unstable_dependencies is not available on the analysis result type
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

  /** 🧾 Analyze pasted package.json content only */
  @Post('analyze-package/paste')
  @ApiOperation({ summary: 'Analyze pasted package.json content' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        json: { type: 'string', description: 'Raw package.json content' },
      },
      required: ['json'],
    },
  })
  async analyzePastedPackage(@Body('json') json: string) {
    if (!json) {
      throw new HttpException('No JSON provided', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.repoHealthService.analyzeJson(json);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

  /** 🔎 Fetch stored repo health from DB */
  @Post('fetch')
  @ApiOperation({ summary: 'Fetch stored repository health info' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { owner: { type: 'string' }, repo: { type: 'string' } },
      required: ['owner', 'repo'],
    },
  })
  async fetchStoredRepo(@Body() body: OwnerRepoBody) {
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
        err instanceof Error ? err.message : 'Unexpected error occurred';
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }
}
