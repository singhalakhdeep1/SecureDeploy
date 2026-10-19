import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDefined, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const NAME = /^[A-Za-z0-9][A-Za-z0-9._\-/]{0,99}$/;

export class ScanRequest {
  @ApiProperty({ example: 'node:22-alpine' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  image: string;

  @ApiPropertyOptional({ description: 'Service the image belongs to; findings are ingested for it when set' })
  @IsOptional()
  @IsString()
  @Matches(NAME)
  service?: string;

  @ApiPropertyOptional({ example: 'production' })
  @IsOptional()
  @IsString()
  @Matches(NAME)
  environment?: string;
}

export class SbomUploadDto {
  @ApiProperty() @IsString() @MaxLength(255) image: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(NAME) service?: string;
  @ApiProperty({ enum: ['spdx-json', 'syft-json', 'cyclonedx-json'] }) @IsIn(['spdx-json', 'syft-json', 'cyclonedx-json']) format: string;
  @ApiProperty({ description: 'The SBOM document' }) @IsDefined() document: Record<string, unknown>;
}
