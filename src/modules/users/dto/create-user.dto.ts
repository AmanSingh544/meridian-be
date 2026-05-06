import { IsEmail, IsString, IsOptional, IsEnum, IsArray, IsUUID, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum UserRole {
  CLIENT_USER = 'CLIENT_USER',
  CLIENT_ADMIN = 'CLIENT_ADMIN',
  AGENT = 'AGENT',
  LEAD = 'LEAD',
  ADMIN = 'ADMIN',
}

const CLIENT_ROLES = [UserRole.CLIENT_ADMIN, UserRole.CLIENT_USER];
const INTERNAL_ROLES = [UserRole.ADMIN, UserRole.LEAD, UserRole.AGENT];

export class CreateUserDto {
  @ApiProperty({ description: 'User email address (unique per tenant)', example: 'alex.morgan@3sc.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Target tenant ID (required in request body)', example: 'uuid-of-tenant' })
  @IsUUID()
  tenant_id: string;

  @ApiProperty({ description: 'System role', enum: UserRole, example: UserRole.CLIENT_ADMIN })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ description: 'First name', example: 'Alex' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ description: 'Last name', example: 'Morgan' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({ description: 'Avatar image URL' })
  @IsOptional()
  @IsString()
  avatar_url?: string;

  @ApiPropertyOptional({
    description: 'Sub-role for internal staff only (DEVELOPER, DELIVERY, SUPPORT, TEAM_LEAD, ADMIN). Rejected for CLIENT_* roles.',
    example: 'SUPPORT',
  })
  @ValidateIf((o) => INTERNAL_ROLES.includes(o.role))
  @IsOptional()
  @IsString()
  internal_sub_role?: string;

  @ApiPropertyOptional({ description: 'Department (internal staff only)', example: 'Engineering' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({
    description: 'Project IDs to assign the user to at invite time. Each must belong to the same tenant_id.',
    type: [String],
    example: ['uuid1', 'uuid2'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  project_ids?: string[];

  @ApiPropertyOptional({
    description: 'Skill IDs to assign (internal staff only). Rejected for CLIENT_* roles.',
    type: [String],
    example: ['uuid3'],
  })
  @ValidateIf((o) => INTERNAL_ROLES.includes(o.role))
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  skill_ids?: string[];
}
