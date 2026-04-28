import { IsEmail, IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from './create-user.dto';

export enum InternalSubRole {
  DELIVERY = 'DELIVERY',
  SUPPORT = 'SUPPORT',
  OPERATIONS = 'OPERATIONS',
  ENGINEERING = 'ENGINEERING',
}

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'Updated email address',
    example: 'alex.morgan@3sc.com',
    format: 'email',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'New password (will be hashed server-side)',
    example: 'n3wP@ssw0rd',
    format: 'password',
    writeOnly: true,
  })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({
    description: 'Updated first name',
    example: 'Alexander',
  })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({
    description: 'Updated last name',
    example: 'Morgan-Jones',
  })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({
    description: 'Updated role',
    enum: UserRole,
    example: UserRole.AGENT,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'Updated avatar URL',
    example: 'https://cdn.example.com/avatars/alex-new.png',
  })
  @IsOptional()
  @IsString()
  avatar_url?: string;

  @ApiPropertyOptional({
    description: 'Whether the user account is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Internal sub-role within the organisation',
    enum: InternalSubRole,
    example: InternalSubRole.DELIVERY,
  })
  @IsOptional()
  @IsString()
  internalSubRole?: string;

  @ApiPropertyOptional({
    description: 'Department the user belongs to',
    example: 'Delivery',
  })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({
    description: 'User timezone (IANA format)',
    example: 'Asia/Kolkata',
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Whether MFA is enabled for this user',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  mfaEnabled?: boolean;
}
