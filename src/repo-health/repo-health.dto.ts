// export class AnalyzeRepoDto {
//   githubUrl?: string;
//   packageJsonText?: string;
// }


// dtos/analyze-repo.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class AnalyzeRepoDto {
  @ApiProperty({ example: 'nestjs', description: 'Repository owner' })
  owner!: string;

  @ApiProperty({ example: 'nest', description: 'Repository name' })
  repo!: string;

  @ApiProperty({ required: false, example: 'ghp_xxx', description: 'GitHub token' })
  token?: string;

  @ApiProperty({ required: false, description: 'Package.json content' })
  packageJson?: string;
}

export class AnalyzeUrlDto {
  @ApiProperty({ example: 'https://github.com/nestjs/nest', description: 'GitHub repository URL' })
  url!: string;

  @ApiProperty({ required: false, example: 'ghp_xxx', description: 'GitHub token' })
  token?: string;

  @ApiProperty({ required: false, description: 'Package.json content' })
  packageJson?: string;
}

export class AnalyzePrivateRepoDto extends AnalyzeRepoDto {
  @ApiProperty({ example: 'ghp_xxx', description: 'GitHub token (required for private repos)' })
  declare token: string;
}

export class AnalyzePrivateUrlDto extends AnalyzeUrlDto {
  @ApiProperty({ example: 'ghp_xxx', description: 'GitHub token (required for private repos)' })
  declare token: string;
}