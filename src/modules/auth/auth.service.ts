import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { getPermissionsForRole } from './permissions';

export interface AuthUserResponse {
  user_id: string;
  email: string;
  user_name: string;
  role: string;
  permissions: string[];
  tenant_id: string;
  tenant_name: string | null;
}

export interface LoginResponse {
  message: string;
  tokens: {
    access: string;
    refresh: string;
  };
  user: AuthUserResponse;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private email: EmailService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email },
      include: {
        tenant: true,
        permission_overrides: true,
      },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return user;
  }

  async validateUserById(userId: string): Promise<AuthUserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
        permission_overrides: true,
      },
    });

    if (!user) throw new UnauthorizedException('User not found');

    return this.buildUserResponse(user);
  }

  private buildUserResponse(user: any): AuthUserResponse {
    const permissions = getPermissionsForRole(
      user.role,
      user.permission_overrides?.map((o: any) => ({
        permission: o.permission,
        type: o.type as 'GRANT' | 'REVOKE',
      })) ?? [],
    );

    const displayName = [user.first_name, user.last_name]
      .filter(Boolean)
      .join(' ')
      || user.email;

    return {
      user_id: user.id,
      email: user.email,
      user_name: displayName,
      role: user.role,
      permissions,
      tenant_id: user.tenant_id,
      tenant_name: user.tenant?.name ?? null,
    };
  }

  async login(user: any): Promise<LoginResponse> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id,
    };

    const accessToken = this.jwt.sign(payload);
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRATION', '7d'),
    });

    return {
      message: 'Login successful',
      tokens: {
        access: accessToken,
        refresh: refreshToken,
      },
      user: this.buildUserResponse(user),
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    if (!user.password_hash) {
      throw new BadRequestException('Password change is not available for this account');
    }

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { password_hash: hash } });
  }

  async sendPasswordReset(emailAddress: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { email: emailAddress } });
    // Always return success to avoid leaking which emails exist
    if (!user) return;

    const resetSecret = this.config.get<string>('JWT_SECRET') + user.password_hash;
    const token = this.jwt.sign(
      { sub: user.id, email: user.email },
      { secret: resetSecret, expiresIn: '1h' },
    );

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'https://meridian-internal-console.vercel.app');
    const resetLink = `${frontendUrl}/reset-password?token=${token}&id=${user.id}`;

    await this.email.send({
      to: emailAddress,
      subject: 'Reset your password',
      html: `
        <p>Hi ${user.first_name ?? 'there'},</p>
        <p>We received a request to reset your password. Click the link below to set a new password:</p>
        <p><a href="${resetLink}">Reset Password</a></p>
        <p>This link expires in 1 hour. If you did not request this, you can safely ignore this email.</p>
      `,
    });
  }

  async confirmPasswordReset(userId: string, token: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Invalid reset link');

    const resetSecret = this.config.get<string>('JWT_SECRET') + user.password_hash;
    try {
      this.jwt.verify(token, { secret: resetSecret });
    } catch {
      throw new BadRequestException('Reset link has expired or is invalid');
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { password_hash: hash } });
  }

  async refresh(refreshToken: string): Promise<LoginResponse> {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          tenant: true,
          permission_overrides: true,
        },
      });

      if (!user) throw new UnauthorizedException();

      return this.login(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
