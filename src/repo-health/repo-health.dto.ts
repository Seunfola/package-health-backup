// repo-health.dto.ts
import { ApiProperty } from '@nestjs/swagger';

// Remove AnalyzeRepoDto and AnalyzePrivateRepoDto since they're no longer used

export class AnalyzeAutoRepoDto {
  @ApiProperty({
    example: 'https://github.com/nestjs/nest',
    description: 'GitHub repository URL',
  })
  url!: string;

  @ApiProperty({
    required: false,
    example: 'ghp_xxx',
    description: 'GitHub token (required only if repository is private)',
  })
  token?: string;
}

export class AnalyzeWithPasteJsonDto {
  @ApiProperty({
    example: 'https://github.com/nestjs/nest',
    description: 'GitHub repository URL',
  })
  url!: string;

  @ApiProperty({
    example: '{"dependencies": {"express": "^4.18.0"}}',
    description: 'Raw package.json content as string',
  })
  packageJson!: string;

  @ApiProperty({
    required: false,
    example: 'ghp_xxx',
    description: 'GitHub token (required only if repository is private)',
  })
  token?: string;
}

export class AnalyzeLegacyUrlDto {
  @ApiProperty({
    example: 'https://github.com/nestjs/nest',
    description: 'GitHub repository URL',
  })
  url!: string;

  @ApiProperty({
    required: false,
    example: 'ghp_xxx',
    description: 'GitHub token (required only if repository is private)',
  })
  token?: string;
}

export class AnalyzeLegacyRepoDto {
  @ApiProperty({
    example: 'nestjs',
    description: 'Repository owner',
  })
  owner!: string;

  @ApiProperty({
    example: 'nest',
    description: 'Repository name',
  })
  repo!: string;

  @ApiProperty({
    required: false,
    example: 'ghp_xxx',
    description: 'GitHub token (required only if repository is private)',
  })
  token?: string;
}
