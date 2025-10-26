// repo-health.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUrl, IsOptional } from 'class-validator';

export class AnalyzeUrlDto {
  @ApiProperty({
    example: 'https://github.com/nestjs/nest',
    description: 'GitHub repository URL',
  })
  @IsUrl()
  @IsNotEmpty()
  url!: string;
}

export class AnalyzePrivateUrlDto {
  @ApiProperty({
    example: 'https://github.com/username/private-repo',
    description: 'GitHub repository URL',
  })
  @IsUrl()
  @IsNotEmpty()
  url!: string;

  @ApiProperty({
    example: 'ghp_xxx',
    description: 'GitHub token (required for private repositories)',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class AnalyzeWithJsonDto {
  @ApiProperty({
    example: 'https://github.com/nestjs/nest',
    description: 'GitHub repository URL',
  })
  @IsUrl()
  @IsNotEmpty()
  url!: string;

  @ApiProperty({
    example: '{"dependencies": {"express": "^4.18.0"}}',
    description: 'Raw package.json content as string',
  })
  @IsString()
  @IsNotEmpty()
  packageJson!: string;
}

export class AnalyzePrivateWithJsonDto {
  @ApiProperty({
    example: 'https://github.com/username/private-repo',
    description: 'GitHub repository URL',
  })
  @IsUrl()
  @IsNotEmpty()
  url!: string;

  @ApiProperty({
    example: 'ghp_xxx',
    description: 'GitHub token (required for private repositories)',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({
    example: '{"dependencies": {"express": "^4.18.0"}}',
    description: 'Raw package.json content as string',
  })
  @IsString()
  @IsNotEmpty()
  packageJson!: string;
}
