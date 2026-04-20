import { ApiProperty } from '@nestjs/swagger';

export class TokensDto {
  @ApiProperty({
    description: 'Access token (empty string when using HttpOnly cookies)',
    example: '',
  })
  access: string;

  @ApiProperty({
    description: 'Refresh token (empty string when using HttpOnly cookies)',
    example: '',
  })
  refresh: string;
}

export class AuthUserResponseDto {
  @ApiProperty({
    description: 'Unique user identifier',
    example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  user_id: string;

  @ApiProperty({
    description: 'User email address',
    example: 'sarah@acmecorp.com',
  })
  email: string;

  @ApiProperty({
    description: 'Display name of the user',
    example: 'Sarah Thompson',
  })
  user_name: string;

  @ApiProperty({
    description: 'User role in the system',
    example: 'CLIENT_ADMIN',
    enum: ['CLIENT_USER', 'CLIENT_ADMIN', 'AGENT', 'LEAD', 'ADMIN'],
  })
  role: string;

  @ApiProperty({
    description: 'Effective permissions for the user (source of truth for UI gating)',
    example: ['TICKET_CREATE', 'TICKET_VIEW_ORG', 'TICKET_EDIT', 'MEMBER_INVITE'],
    type: [String],
  })
  permissions: string[];

  @ApiProperty({
    description: 'Organization / tenant identifier',
    example: 'org_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  tenant_id: string;

  @ApiProperty({
    description: 'Organization / tenant name',
    example: 'Acme Corp',
    nullable: true,
  })
  tenant_name: string | null;
}

export class LoginResponseDto {
  @ApiProperty({
    description: 'Human-readable status message',
    example: 'Login successful',
  })
  message: string;

  @ApiProperty({ type: TokensDto })
  tokens: TokensDto;

  @ApiProperty({ type: AuthUserResponseDto })
  user: AuthUserResponseDto;
}

export class SessionResponseDto {
  @ApiProperty({ type: AuthUserResponseDto })
  data: AuthUserResponseDto;
}

export class LogoutResponseDto {
  @ApiProperty({
    description: 'Human-readable status message',
    example: 'Logged out successfully',
  })
  message: string;
}

export class RefreshResponseDto {
  @ApiProperty({
    description: 'Human-readable status message',
    example: 'Token refreshed successfully',
  })
  message: string;

  @ApiProperty({ type: TokensDto })
  tokens: TokensDto;

  @ApiProperty({ type: AuthUserResponseDto })
  user: AuthUserResponseDto;
}
