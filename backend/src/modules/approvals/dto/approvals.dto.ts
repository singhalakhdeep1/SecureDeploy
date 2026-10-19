import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { DeploymentStatus } from '@prisma/client';

const NAME = /^[A-Za-z0-9][A-Za-z0-9._\-/]{0,99}$/;

export class RequestDeploymentDto {
  @ApiProperty() @IsString() @Matches(NAME) service: string;
  @ApiProperty() @IsString() @Matches(NAME) environment: string;
  @ApiProperty() @IsString() @MaxLength(100) version: string;
  @ApiProperty() @IsString() @Matches(/^[0-9a-f]{7,40}$/i, { message: 'commitSha must be a 7-40 character hex SHA' }) commitSha: string;
}

export class WebhookDeploymentDto extends RequestDeploymentDto {
  @ApiProperty({ description: 'Who/what requested the deployment (e.g. CI pipeline id)' }) @IsString() @MaxLength(200) requestedBy: string;
}

export class ApproveDeploymentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) comments?: string;
}

export class RejectDeploymentDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(2000) reason: string;
}

export class ExceptionDto {
  @ApiProperty({ type: [String], description: 'Open critical finding ids accepted as exceptions' })
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  findingIds: string[];

  @ApiProperty() @IsString() @MinLength(10) @MaxLength(2000) justification: string;
}

export class DeploymentsQueryDto {
  @IsOptional() @IsString() service?: string;
  @IsOptional() @IsString() environment?: string;
  @IsOptional() @IsEnum(DeploymentStatus) status?: DeploymentStatus;
}
