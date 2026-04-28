import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'oldP@ssw0rd',
    format: 'password',
    writeOnly: true,
  })
  @IsString()
  @MinLength(1, { message: 'Current password is required' })
  current_password: string;

  @ApiProperty({
    description: 'New password',
    example: 'n3wP@ssw0rd',
    format: 'password',
    writeOnly: true,
  })
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  new_password: string;
}
