import { ApiProperty } from '@nestjs/swagger';

export class AnalyzeRepoDto {
  @ApiProperty({
    example: 'https://github.com/nestjs/nest',
    description: 'GitHub repository URL',
  })
  url!: string;

  @ApiProperty({
    required: false,
    description: 'Package.json content',
  })
  packageJson?: string;
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

  @ApiProperty({
    required: false,
    description: 'Package.json content',
  })
  packageJson?: string;
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

  @ApiProperty({
    required: false,
    description: 'Package.json content',
  })
  packageJson?: string;
}
