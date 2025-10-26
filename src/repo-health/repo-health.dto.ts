import { ApiProperty } from '@nestjs/swagger';

import { IsString, IsNotEmpty, IsUrl, IsOptional } from 'class-validator';

export class AnalyzeAutoRepoDto {
  @ApiProperty({
    example: 'https://github.com/nestjs/nest',
    description: 'GitHub repository URL',
  })
  @IsUrl()
  @IsNotEmpty()
  url!: string;

  @ApiProperty({
    required: false,
    example: 'ghp_xxx',
    description: 'GitHub token (required only if repository is private)',
  })
  @IsString()
  @IsOptional()
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
