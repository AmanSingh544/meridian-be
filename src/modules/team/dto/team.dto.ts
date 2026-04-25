import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../users/dto/create-user.dto';

export class InviteUserDto {
  @ApiProperty({ example: 'new.user@acmecorp.com' })
  @IsString()
  email: string;

  @ApiProperty({ enum: UserRole, example: UserRole.CLIENT_USER })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ example: 'Jane' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  last_name?: string;
}

export class UpdateTeamMemberRoleDto {
  @ApiProperty({ enum: UserRole, example: UserRole.AGENT })
  @IsEnum(UserRole)
  role: UserRole;
}

export class UpdatePermissionDto {
  @ApiProperty({ example: 'TICKET_EDIT' })
  @IsString()
  permission: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  enabled: boolean;
}

export class ScoringWeightsDto {
  @ApiProperty({ example: 0.5 })
  w_skill: number;

  @ApiProperty({ example: 0.35 })
  w_workload: number;

  @ApiProperty({ example: 0.15 })
  w_avail: number;
}

export class TeamMemberResponseDto {
  @ApiProperty({ example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'alex.morgan@3sc.com' })
  email: string;

  @ApiProperty({ example: 'Alex', nullable: true })
  first_name: string | null;

  @ApiProperty({ example: 'Morgan', nullable: true })
  last_name: string | null;

  @ApiProperty({ example: 'ADMIN' })
  role: string;

  @ApiProperty({ example: true })
  is_active: boolean;
}
