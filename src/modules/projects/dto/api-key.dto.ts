import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'VS Code Extension' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: '2027-01-01T00:00:00.000Z', description: 'ISO date; omit for no expiry' })
  @IsOptional()
  @IsDateString()
  expires_at?: string;
}

export class ApiKeyResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ example: 'mk_a1b2c3d4' })
  key_prefix: string;

  @ApiPropertyOptional({ description: 'Only present on initial creation — store it, it will not be shown again' })
  raw_token?: string;

  @ApiProperty()
  tenant_id: string;

  @ApiPropertyOptional()
  project_id?: string | null;

  @ApiProperty()
  created_by: string;

  @ApiPropertyOptional()
  last_used_at?: Date | null;

  @ApiPropertyOptional()
  expires_at?: Date | null;

  @ApiProperty()
  is_active: boolean;

  @ApiProperty()
  created_at: Date;
}
