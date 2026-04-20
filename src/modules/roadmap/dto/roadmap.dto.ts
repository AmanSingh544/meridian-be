import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RoadmapFeatureResponseDto {
  @ApiProperty({ example: 'rmf_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'AI Auto-Reply' })
  title: string;

  @ApiProperty({ example: 'Automatically generate replies using AI', nullable: true })
  description: string | null;

  @ApiProperty({ example: 'planned' })
  status: string;

  @ApiProperty({ example: 42 })
  votes: number;

  @ApiProperty({ example: '2026-04-16T10:00:00Z' })
  created_at: string;

  @ApiProperty({ example: '2026-04-16T10:00:00Z' })
  updated_at: string;
}

export class SubmitFeatureRequestDto {
  @ApiProperty({ example: 'Dark Mode Support' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Please add dark mode to the portal' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class VoteResponseDto {
  @ApiProperty({ example: 'rmf_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  feature_id: string;

  @ApiProperty({ example: 43 })
  upvotes: number;

  @ApiProperty({ example: true })
  has_voted: boolean;
}
