import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Global()
@Module({
  providers: [
    { provide: PrismaService, useValue: {} },
    { provide: EmailService, useValue: {} },
    { provide: ConfigService, useValue: { get: jest.fn((key: string) => key === 'JWT_SECRET' ? 'test-secret' : undefined) } },
  ],
  exports: [PrismaService, EmailService, ConfigService],
})
class MockGlobalModule {}

describe('AuthModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [MockGlobalModule, AuthModule],
    }).compile();
  });

  it('should compile the module', () => {
    expect(module).toBeDefined();
  });

  it('should resolve AuthService', () => {
    const service = module.get<AuthService>(AuthService);
    expect(service).toBeDefined();
  });

  it('should resolve AuthController', () => {
    const controller = module.get<AuthController>(AuthController);
    expect(controller).toBeDefined();
  });
});
