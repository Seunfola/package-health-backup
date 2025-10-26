import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { RepoHealthService } from './services/repo-health.service';
import {
  AnalyzeRepoDto,
  AnalyzePrivateRepoDto,
  AnalyzeAutoRepoDto,
  AnalyzeWithPasteJsonDto,
} from './repo-health.dto';

@ApiTags('repo-health')
@Controller('repo-health')
export class RepoHealthController {
  constructor(private readonly repoHealthService: RepoHealthService) {}


  @Post('public')
  @ApiOperation({
    summary: 'Analyze PUBLIC repository by URL',
    description: 'No token required for public repositories',
  })
  @ApiBody({ type: AnalyzeRepoDto })
  async analyzePublicRepo(@Body() body: AnalyzeRepoDto) {
    const { url } = body;

    if (!url) {
      throw new HttpException('GitHub URL is required', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.repoHealthService.analyzePublicRepoByUrl(url);
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
    description: 'Token is REQUIRED for private repositories',
  })
  @ApiBody({ type: AnalyzePrivateRepoDto })
  async analyzePrivateRepo(@Body() body: AnalyzePrivateRepoDto) {
    const { url, token } = body;

    if (!url || !token) {
      throw new HttpException(
        'URL and token are required for private repositories',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.repoHealthService.analyzePrivateRepoByUrl(url, token);
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      const message =
        err instanceof Error ? err.message : 'Unexpected error occurred';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('analyze')
  @ApiOperation({
    summary: 'Auto-detect repository type and analyze by URL',
    description: 'Token is required only if repository is private',
  })
  @ApiBody({ type: AnalyzeAutoRepoDto })
  async analyzeRepoAuto(@Body() body: AnalyzeAutoRepoDto) {
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

  @Post('public/paste-json')
  @ApiOperation({
    summary: 'Analyze PUBLIC repository with pasted package.json',
    description: 'No token required for public repositories',
  })
  @ApiBody({ type: AnalyzeWithPasteJsonDto })
  async analyzePublicRepoWithPasteJson(
    @Body() body: Omit<AnalyzeWithPasteJsonDto, 'token'>,
  ) {
    const { url, packageJson } = body;

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
      return await this.repoHealthService.analyzePublicRepoByUrl(
        url,
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

  @Post('private/paste-json')
  @ApiOperation({
    summary: 'Analyze PRIVATE repository with pasted package.json',
    description: 'Token is REQUIRED for private repositories',
  })
  @ApiBody({ type: AnalyzeWithPasteJsonDto })
  async analyzePrivateRepoWithPasteJson(
    @Body() body: AnalyzeWithPasteJsonDto & { token: string },
  ) {
    const { url, token, packageJson } = body;

    if (!url || !token) {
      throw new HttpException(
        'URL and token are required for private repositories',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!packageJson) {
      throw new HttpException(
        'Package.json content is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const rawJson = JSON.parse(packageJson);
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

  @Post('analyze/paste-json')
  @ApiOperation({
    summary: 'Auto-detect repository type with pasted package.json',
    description: 'Token is required only if repository is private',
  })
  @ApiBody({ type: AnalyzeWithPasteJsonDto })
  async analyzeRepoAutoWithPasteJson(@Body() body: AnalyzeWithPasteJsonDto) {
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
      const rawJson = JSON.parse(packageJson);
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

  @Post('public/upload-json')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Analyze PUBLIC repository with uploaded package.json file',
    description: 'No token required for public repositories',
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
        file: {
          type: 'string',
          format: 'binary',
          description: 'package.json file to upload',
        },
      },
      required: ['url', 'file'],
    },
  })
  async analyzePublicRepoWithUpload(
    @Body('url') url: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!url) {
      throw new HttpException('GitHub URL is required', HttpStatus.BAD_REQUEST);
    }

    if (!file) {
      throw new HttpException('File is required', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.repoHealthService.analyzePublicRepoByUrl(url, file);
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      const message =
        err instanceof Error ? err.message : 'Unexpected error occurred';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('private/upload-json')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Analyze PRIVATE repository with uploaded package.json file',
    description: 'Token is REQUIRED for private repositories',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          example: 'https://github.com/username/private-repo',
          description: 'GitHub repository URL',
        },
        token: {
          type: 'string',
          example: 'ghp_xxx',
          description: 'GitHub token',
        },
        file: {
          type: 'string',
          format: 'binary',
          description: 'package.json file to upload',
        },
      },
      required: ['url', 'token', 'file'],
    },
  })
  async analyzePrivateRepoWithUpload(
    @Body('url') url: string,
    @Body('token') token: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!url || !token) {
      throw new HttpException(
        'URL and token are required for private repositories',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!file) {
      throw new HttpException('File is required', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.repoHealthService.analyzePrivateRepoByUrl(
        url,
        token,
        file,
      );
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      const message =
        err instanceof Error ? err.message : 'Unexpected error occurred';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('analyze/upload-json')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Auto-detect repository type with uploaded package.json file',
    description: 'Token is required only if repository is private',
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
  async analyzeRepoAutoWithUpload(
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
}
