import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsDefined, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, MaxLength, Min, ValidateIf, ValidateNested,
} from 'class-validator';
import { FindingStatus } from '@prisma/client';

export class FindingDto {
  @ApiPropertyOptional() @IsString() @IsOptional() severity?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) title?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(10000) description?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() category?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() filePath?: string;
  @ApiPropertyOptional() @IsInt() @IsOptional() lineNumber?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() cveId?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() cvssScore?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() packageName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() installedVersion?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() fixedVersion?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() remediation?: string;
}

const NAME = /^[A-Za-z0-9][A-Za-z0-9._\-/]{0,99}$/;

export class IngestFindingsDto {
  @ApiProperty({ example: 'trivy' }) @IsString() @Matches(/^[a-z0-9-]{2,40}$/i) tool: string;
  @ApiProperty() @IsString() @MaxLength(200) scanId: string;
  @ApiProperty() @IsString() @Matches(NAME) service: string;
  @ApiProperty() @IsString() @Matches(NAME) environment: string;

  @ApiPropertyOptional({ type: [FindingDto], description: 'Pre-normalized findings' })
  @ValidateIf((o) => o.raw === undefined)
  @IsArray()
  @ArrayMaxSize(10000)
  @ValidateNested({ each: true })
  @Type(() => FindingDto)
  findings?: FindingDto[];

  @ApiPropertyOptional({ description: 'Native scanner JSON (trivy, grype, semgrep, trufflehog, npm-audit, kube-bench, falco)' })
  @ValidateIf((o) => o.findings === undefined)
  @IsDefined()
  raw?: unknown;

  @ApiPropertyOptional({ description: 'This scan covers everything the tool checks for the service; open findings it no longer reports are auto-resolved' })
  @IsOptional()
  @IsBoolean()
  fullScan?: boolean;
}

export class UpdateFindingStatusDto {
  @ApiProperty({ enum: FindingStatus }) @IsEnum(FindingStatus) status: FindingStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

export class ResolveFindingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

export class FindingsQueryDto {
  @IsOptional() @IsString() service?: string;
  @IsOptional() @IsString() environment?: string;
  @IsOptional() @IsIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']) severity?: string;
  @IsOptional() @IsEnum(FindingStatus) status?: FindingStatus;
  @IsOptional() @IsString() tool?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}
