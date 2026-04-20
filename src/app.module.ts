import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { AiModule } from './modules/ai/ai.module';
import { CommentsModule } from './modules/comments/comments.module';
import { HealthModule } from './modules/health/health.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { PrismaModule } from './shared/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000, // 1 minute
        limit: 100,
      },
      {
        name: 'long',
        ttl: 600000, // 10 minutes
        limit: 500,
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    TicketsModule,
    AiModule,
    CommentsModule,
    OrganizationsModule,
    HealthModule,
  ],
})
export class AppModule {}
