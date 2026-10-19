import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class GenerateReportDto {
  @ApiProperty({ example: 'DPDP_ACT' }) @IsString() framework: string;
  @ApiProperty({ example: '2026-01-01' }) @IsDateString() startDate: string;
  @ApiProperty({ example: '2026-03-31' }) @IsDateString() endDate: string;
  @ApiPropertyOptional() @IsOptional() @IsString() service?: string;
}
