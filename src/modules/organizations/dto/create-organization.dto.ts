import { IsString, IsNotEmpty, IsOptional, IsObject, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrganizationDto {
  @ApiProperty({ description: 'Organization display name', example: 'Acme Corp' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'URL-friendly unique slug', example: 'acme-corp' })
  @IsNotEmpty()
  @IsString()
  slug: string;

  @ApiPropertyOptional({ description: 'Custom domain', example: 'acme.com' })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional({ description: 'Subscription plan', example: 'free' })
  @IsOptional()
  @IsString()
  plan?: string;

  @ApiPropertyOptional({ description: 'Organization settings (JSON object)', example: {} })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Branding configuration (JSON object)', example: {} })
  @IsOptional()
  @IsObject()
  branding?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Whether the organization is active', example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
