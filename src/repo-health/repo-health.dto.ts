import { ApiProperty } from '@nestjs/swagger';

export class AnalyzePublicRepoDto {
  @ApiProperty({ example: 'nestjs', description: 'Repository owner' })
  owner!: string;

  @ApiProperty({ example: 'nest', description: 'Repository name' })
  repo!: string;

  @ApiProperty({ required: false, description: 'Package.json content' })
  packageJson?: string;
}

export class AnalyzePrivateRepoDto {
  @ApiProperty({ example: 'your-username', description: 'Repository owner' })
  owner!: string;

  @ApiProperty({ example: 'your-private-repo', description: 'Repository name' })
  repo!: string;

  @ApiProperty({
    example: 'ghp_xxx',
    description: 'GitHub token (required for private repos)',
  })
  token!: string;

  @ApiProperty({ required: false, description: 'Package.json content' })
  packageJson?: string;
}

export class AnalyzePublicUrlDto {
  @ApiProperty({
    example: 'https://github.com/nestjs/nest',
    description: 'GitHub repository URL',
  })
  url!: string;

  @ApiProperty({ required: false, description: 'Package.json content' })
  packageJson?: string;
}

export class AnalyzePrivateUrlDto {
  @ApiProperty({
    example: 'https://github.com/username/private-repo',
    description: 'GitHub repository URL',
  })
  url!: string;

  @ApiProperty({
    example: 'ghp_xxx',
    description: 'GitHub token (required for private repos)',
  })
  token!: string;

  @ApiProperty({ required: false, description: 'Package.json content' })
  packageJson?: string;
}

export class AnalyzeAutoRepoDto {
  @ApiProperty({ example: 'nestjs', description: 'Repository owner' })
  owner!: string;

  @ApiProperty({ example: 'nest', description: 'Repository name' })
  repo!: string;

  @ApiProperty({
    required: false,
    example: 'ghp_xxx',
    description: 'GitHub token (required only if repository is private)',
  })
  token?: string;

  @ApiProperty({ required: false, description: 'Package.json content' })
  packageJson?: string;
}

export class AnalyzeAutoUrlDto {
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

  @ApiProperty({ required: false, description: 'Package.json content' })
  packageJson?: string;
}