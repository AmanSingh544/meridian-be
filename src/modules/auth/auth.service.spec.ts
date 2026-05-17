import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { EmailService } from '../email/email.service';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  password_hash: 'hashed',
  role: 'CLIENT_USER',
  tenant_id: 'tenant-1',
  tenant: { name: 'Test Tenant' },
  permission_overrides: [],
};

const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('token'),
  verify: jest.fn().mockReturnValue({ sub: 'user-1' }),
};

const mockConfig = {
  get: jest.fn((key: string, defaultValue?: any) => {
    const map: Record<string, any> = {
      JWT_SECRET: 'secret',
      JWT_REFRESH_SECRET: 'refresh-secret',
      JWT_REFRESH_EXPIRATION: '7d',
      FRONTEND_URL: 'https://example.com',
    };
    return map[key] ?? defaultValue;
  }),
};

const mockEmail = {
  send: jest.fn().mockResolvedValue(undefined),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should throw UnauthorizedException when user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await expect(service.validateUser('test@example.com', 'password')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateUserById', () => {
    it('should return user response with permissions', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.validateUserById('user-1');
      expect(result.user_id).toBe('user-1');
      expect(result.permissions).toBeDefined();
      expect(result.tenant_name).toBe('Test Tenant');
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.validateUserById('user-1')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should return tokens and user response', async () => {
      const result = await service.login(mockUser);
      expect(result.tokens.access).toBe('token');
      expect(result.tokens.refresh).toBe('token');
      expect(result.user.email).toBe('test@example.com');
    });
  });

  describe('changePassword', () => {
    it('should throw BadRequestException if current password is incorrect', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      jest.spyOn(require('bcrypt'), 'compare').mockResolvedValueOnce(false);
      await expect(service.changePassword('user-1', 'wrong', 'new')).rejects.toThrow(BadRequestException);
    });
  });

  describe('sendPasswordReset', () => {
    it('should return silently if user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await expect(service.sendPasswordReset('missing@example.com')).resolves.toBeUndefined();
      expect(mockEmail.send).not.toHaveBeenCalled();
    });

    it('should send email if user exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      await service.sendPasswordReset('test@example.com');
      expect(mockEmail.send).toHaveBeenCalled();
    });
  });

  describe('confirmPasswordReset', () => {
    it('should throw BadRequestException for invalid user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.confirmPasswordReset('user-1', 'token', 'new')).rejects.toThrow(BadRequestException);
    });
  });

  describe('refresh', () => {
    it('should return new tokens for valid refresh token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.refresh('refresh-token');
      expect(result.tokens.access).toBe('token');
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      mockJwt.verify.mockImplementationOnce(() => {
        throw new Error('invalid');
      });
      await expect(service.refresh('bad-token')).rejects.toThrow(UnauthorizedException);
    });
  });
});
