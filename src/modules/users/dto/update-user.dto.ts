import { IsEmail, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from './create-user.dto';

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
}
