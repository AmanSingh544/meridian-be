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
  HttpStatus,
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
    const sameSite = this.config.get<'lax' | 'strict' | 'none'>('COOKIE_SAME_SITE', 'lax');
    // SameSite=None requires Secure=true (RFC 6265bis)
    const secure = sameSite === 'none' ? true : this.config.get('NODE_ENV') === 'production';

    return {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: maxAgeMs,
      path: '/',
    };
  }

  private getTokenNames(req: any): { access: string; refresh: string } {
    const portal = req.headers?.['x-portal-type'];
    if (portal === 'internal') {
      return { access: 'internal_access_token', refresh: 'internal_refresh_token' };
    }
    return { access: 'customer_access_token', refresh: 'customer_refresh_token' };
  }


  private static readonly INTERNAL_ROLES = new Set(['AGENT', 'LEAD', 'ADMIN']);
  private static readonly CUSTOMER_ROLES = new Set(['CLIENT_USER', 'CLIENT_ADMIN']);

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
  @ApiResponse({ status: 403, description: 'Role not permitted for this portal' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(dto.email, dto.password);

    const portal = req.headers?.['x-portal-type'];
    const isInternal = portal === 'internal';
    const allowedRoles = isInternal
      ? AuthController.INTERNAL_ROLES
      : AuthController.CUSTOMER_ROLES;

    if (!allowedRoles.has(user.role)) {
      throw new UnauthorizedException(
        isInternal
          ? 'This account does not have access to the internal console.'
          : 'This account does not have access to the customer portal.',
      );
    }

    const result = await this.authService.login(user);

    const accessMaxAge = 15 * 60 * 1000; // 15 minutes
    const refreshMaxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    const names = this.getTokenNames(req);

    res.cookie(
      names.access,
      result.tokens.access,
      this.getCookieOptions(accessMaxAge),
    );
    res.cookie(
      names.refresh,
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
    const names = this.getTokenNames(req);
    const refreshToken = req.cookies?.[names.refresh] || req.cookies?.['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token');
    }

    const result = await this.authService.refresh(refreshToken);

    const accessMaxAge = 15 * 60 * 1000;
    const refreshMaxAge = 7 * 24 * 60 * 60 * 1000;

    res.cookie(
      names.access,
      result.tokens.access,
      this.getCookieOptions(accessMaxAge),
    );
    res.cookie(
      names.refresh,
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
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const names = this.getTokenNames(req);
    res.clearCookie(names.access, { httpOnly: true, path: '/' });
    res.clearCookie(names.refresh, { httpOnly: true, path: '/' });
    // Also clear legacy cookies to ensure clean logout during migration
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

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a password reset link to the given email' })
  @ApiBody({ schema: { properties: { email: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Reset link sent if the account exists' })
  async resetPassword(@Body() body: { email: string }) {
    await this.authService.sendPasswordReset(body.email);
    return { message: 'If an account with that email exists, a reset link has been sent.' };
  }

  @Post('confirm-reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a new password using a reset token' })
  @ApiBody({ schema: { properties: { userId: { type: 'string' }, token: { type: 'string' }, newPassword: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  async confirmResetPassword(@Body() body: { userId: string; token: string; newPassword: string }) {
    await this.authService.confirmPasswordReset(body.userId, body.token, body.newPassword);
    return { message: 'Password reset successfully' };
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
