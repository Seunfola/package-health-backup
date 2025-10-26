import { ApiProperty } from '@nestjs/swagger';

export class AnalyzeRepoDto {
  @ApiProperty({
    example: 'https://github.com/nestjs/nest',
    description: 'GitHub repository URL',
  })
  url!: string;
}

export class AnalyzePrivateRepoDto {
  @ApiProperty({
    example: 'https://github.com/username/private-repo',
    description: 'GitHub repository URL',
  })
  url!: string;

  @ApiProperty({
    example: 'ghp_xxx',
    description: 'GitHub token (required for private repositories)',
  })
  token!: string;
}

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
