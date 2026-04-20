import { IsEmail, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum UserRole {
  CLIENT_USER = 'CLIENT_USER',
  CLIENT_ADMIN = 'CLIENT_ADMIN',
  AGENT = 'AGENT',
  LEAD = 'LEAD',
  ADMIN = 'ADMIN',
}

export class CreateUserDto {
  @ApiProperty({
    description: 'User email address (unique across the system)',
    example: 'alex.morgan@3sc.com',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'Initial password. If omitted, a random temporary password is generated.',
    example: 's3cur3P@ss',
    format: 'password',
    writeOnly: true,
  })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({
    description: 'First name',
    example: 'Alex',
  })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({
    description: 'Last name',
    example: 'Morgan',
  })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiProperty({
    description: 'System role',
    enum: UserRole,
    example: UserRole.CLIENT_ADMIN,
  })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({
    description: 'Avatar image URL',
    example: 'https://cdn.example.com/avatars/alex.png',
  })
  @IsOptional()
  @IsString()
  avatar_url?: string;
}
