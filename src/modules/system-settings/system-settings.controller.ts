import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiCookieAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { SystemSettingsService } from './system-settings.service';
import { UpdateSystemSettingsDto } from './dto/system-settings.dto';

@ApiTags('System Settings')
@ApiCookieAuth('access_token')
@Controller('system-settings')
@UseGuards(JwtAuthGuard)
export class SystemSettingsController {
  constructor(private systemSettingsService: SystemSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get system settings for the current tenant' })
  @ApiResponse({ status: 200 })
  getSettings(@CurrentUser('tenantId') tenantId: string) {
    return this.systemSettingsService.getSettings(tenantId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update system settings for the current tenant' })
  @ApiBody({ type: UpdateSystemSettingsDto })
  @ApiResponse({ status: 200 })
  updateSettings(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: UpdateSystemSettingsDto,
  ) {
    return this.systemSettingsService.updateSettings(tenantId, dto);
  }
}
