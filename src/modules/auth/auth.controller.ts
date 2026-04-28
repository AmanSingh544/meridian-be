import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  UnauthorizedException,
  Res,
  Req,
  HttpCode,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  LoginResponseDto,
  RefreshResponseDto,
  LogoutResponseDto,
  SessionResponseDto,
} from './dto/auth-response.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  private getCookieOptions(maxAgeMs: number) {
    const isProd = this.config.get('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax' as const,
      maxAge: maxAgeMs,
      path: '/',
    };
  }

  @Post('login')
  @ApiOperation({
    summary: 'Authenticate a user and start a session',
    description:
      'Validates credentials and returns session info. Access & refresh tokens are set as HttpOnly cookies automatically.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    const result = await this.authService.login(user);

    const accessMaxAge = 15 * 60 * 1000; // 15 minutes
    const refreshMaxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    res.cookie(
      'access_token',
      result.tokens.access,
      this.getCookieOptions(accessMaxAge),
    );
    res.cookie(
      'refresh_token',
      result.tokens.refresh,
      this.getCookieOptions(refreshMaxAge),
    );

    // Return tokens as empty strings since cookies handle transport
    return {
      message: result.message,
      tokens: { access: '', refresh: '' },
      user: result.user,
    };
  }

  @Post('token/refresh')
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Refreshes the access token using the refresh token sent via HttpOnly cookie.',
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: RefreshResponseDto,
  })
  @ApiResponse({ status: 401, description: 'No refresh token or invalid token' })
  async refresh(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token');
    }

    const result = await this.authService.refresh(refreshToken);

    const accessMaxAge = 15 * 60 * 1000;
    const refreshMaxAge = 7 * 24 * 60 * 60 * 1000;

    res.cookie(
      'access_token',
      result.tokens.access,
      this.getCookieOptions(accessMaxAge),
    );
    res.cookie(
      'refresh_token',
      result.tokens.refresh,
      this.getCookieOptions(refreshMaxAge),
    );

    return {
      message: result.message,
      tokens: { access: '', refresh: '' },
      user: result.user,
    };
  }

  @Post('logout')
  @ApiOperation({
    summary: 'Invalidate the current session',
    description: 'Clears access_token and refresh_token cookies.',
  })
  @ApiResponse({
    status: 200,
    description: 'Logged out successfully',
    type: LogoutResponseDto,
  })
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', { httpOnly: true, path: '/' });
    res.clearCookie('refresh_token', { httpOnly: true, path: '/' });
    return { message: 'Logged out successfully' };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @HttpCode(200)
  @ApiOperation({ summary: 'Change the current user\'s password' })
  @ApiBody({ type: ChangePasswordDto })
  async changePassword(
    @CurrentUser('userId') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(userId, dto.current_password, dto.new_password);
    return { message: 'Password changed successfully' };
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'Get current session info',
    description:
      'Validates the current session and returns user info. Called on every app load.',
  })
  @ApiQuery({
    name: 'tenant_id',
    required: false,
    description: 'Tenant ID injected by the frontend for multi-tenancy',
    example: 'org_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @ApiResponse({
    status: 200,
    description: 'Current session info',
    type: SessionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Session expired or invalid' })
  async session(
    @CurrentUser() user: any,
    @Query('tenant_id') _tenantId?: string,
  ) {
    const fullUser = await this.authService.validateUserById(user.userId);
    return {
      data: fullUser,
    };
  }
}
