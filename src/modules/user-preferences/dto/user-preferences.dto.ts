import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserPreferencesDto {
  @ApiProperty({ example: 'cobalt' })
  accent_color: string;

  @ApiProperty({ example: 'system' })
  color_mode: string;

  @ApiProperty({ example: 'comfortable' })
  density: string;

  @ApiProperty({ example: true })
  email_on_new_reply: boolean;

  @ApiProperty({ example: true })
  email_on_status_change: boolean;

  @ApiProperty({ example: true })
  email_on_mention: boolean;

  @ApiProperty({ example: false })
  email_digest: boolean;

  @ApiProperty({ example: true })
  browser_push: boolean;

  @ApiPropertyOptional({ example: true })
  email_on_ticket_assigned?: boolean;

  @ApiPropertyOptional({ example: true })
  email_on_sla_warning?: boolean;
}

export class UpdateUserPreferencesDto {
  @ApiPropertyOptional({ example: 'emerald' })
  @IsOptional()
  @IsString()
  accent_color?: string;

  @ApiPropertyOptional({ example: 'dark' })
  @IsOptional()
  @IsString()
  color_mode?: string;

  @ApiPropertyOptional({ example: 'compact' })
  @IsOptional()
  @IsString()
  density?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  email_on_new_reply?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  email_on_status_change?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  email_on_mention?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  email_digest?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  browser_push?: boolean;
}
