import { IsEmail, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'sarah@acmecorp.com',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 's3cur3P@ss',
    format: 'password',
    writeOnly: true,
  })
  @IsString()
  password: string;

  @ApiProperty({
    description: 'Organization tenant slug (optional, for multi-tenant login pages)',
    example: 'acme-corp',
    required: false,
  })
  @IsOptional()
  @IsString()
  tenant_slug?: string;
}
