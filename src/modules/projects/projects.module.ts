import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyGuard } from '../../shared/guards/api-key.guard';
import { ApiKeyOrJwtGuard } from '../../shared/guards/api-key-or-jwt.guard';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { PermissionGuard } from '../../shared/guards/permission.guard';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, ApiKeysService, ApiKeyGuard, ApiKeyOrJwtGuard, JwtAuthGuard, PermissionGuard],
  exports: [ApiKeyGuard, ApiKeyOrJwtGuard, JwtAuthGuard],
})
export class ProjectsModule {}
