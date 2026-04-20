import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSkillDto {
  @ApiProperty({ example: 'React' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'TECHNICAL' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'Frontend framework expertise' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateUserSkillsDto {
  @ApiProperty({ example: ['skill_01', 'skill_02'], type: [String] })
  @IsString({ each: true })
  skill_ids: string[];
}

export class SkillResponseDto {
  @ApiProperty({ example: 'skill_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'React' })
  name: string;

  @ApiProperty({ example: 'TECHNICAL', nullable: true })
  category: string | null;

  @ApiProperty({ example: 'Frontend framework expertise', nullable: true })
  description: string | null;

  @ApiProperty({ example: '2026-04-16T10:00:00Z' })
  created_at: string;
}

export class UserSkillResponseDto {
  @ApiProperty({ example: 'usr_skill_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  user_id: string;

  @ApiProperty({ type: SkillResponseDto })
  skill: SkillResponseDto;

  @ApiProperty({ example: 3 })
  proficiency: number;
}
