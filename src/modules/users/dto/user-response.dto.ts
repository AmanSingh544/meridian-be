import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserDto {
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

  @ApiProperty({ example: 'https://cdn.example.com/avatars/alex.png', nullable: true })
  avatar_url: string | null;

  @ApiPropertyOptional({
    description: 'JSON preferences object (only returned by GET /users/:id)',
    example: { theme: 'dark', notifications: true },
  })
  preferences?: Record<string, any>;

  @ApiProperty({ example: '2026-04-16T08:30:00Z', nullable: true })
  last_active_at: string | null;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  created_at: string;
}

export class PaginatedUserResponseDto {
  @ApiProperty({ type: [UserDto] })
  data: UserDto[];

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  page_size: number;

  @ApiProperty({ example: 142 })
  total: number;

  @ApiProperty({ example: 8 })
  total_pages: number;
}

export class SingleUserResponseDto {
  @ApiProperty({ type: UserDto })
  data: UserDto;
}

export class UserDeleteResponseDto {
  @ApiProperty({ example: 'User deleted successfully' })
  message: string;
}
