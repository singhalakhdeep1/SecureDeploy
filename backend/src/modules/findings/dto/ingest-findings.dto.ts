import { IsString, IsArray, IsOptional, IsEnum } from 'class-validator';

export class IngestFindingsDto {
  @IsString()
  tool: string; // trivy, semgrep, trufflehog, npm-audit

  @IsString()
  scanId: string;

  @IsString()
  service: string;

  @IsString()
  environment: string;

  @IsArray()
  findings: FindingDto[];
}

export class FindingDto {
  @IsString()
  @IsOptional()
  severity?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  filePath?: string;

  @IsNumber()
  @IsOptional()
  lineNumber?: number;

  @IsString()
  @IsOptional()
  cveId?: string;

  @IsNumber()
  @IsOptional()
  cvssScore?: number;

  @IsString()
  @IsOptional()
  remediation?: string;
}
