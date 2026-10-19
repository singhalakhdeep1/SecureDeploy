import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class RegisterDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) @MaxLength(128) password: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) name: string;
}

export class LoginDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() password: string;
}

export class UpdateRoleDto {
  @ApiProperty({ enum: Role }) @IsEnum(Role) role: Role;
}

export class AssignServicesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  services: string[];
}

export class ChangePasswordDto {
  @ApiProperty() @IsString() currentPassword: string;
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) @MaxLength(128) newPassword: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
}
