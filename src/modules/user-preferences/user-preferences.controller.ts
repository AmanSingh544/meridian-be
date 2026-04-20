import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiCookieAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { UserPreferencesService } from './user-preferences.service';
import { UserPreferencesDto, UpdateUserPreferencesDto } from './dto/user-preferences.dto';

@ApiTags('User Preferences')
@ApiCookieAuth('access_token')
@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class UserPreferencesController {
  constructor(private userPreferencesService: UserPreferencesService) {}

  @Get('preferences')
  @ApiOperation({ summary: 'Get current user preferences' })
  @ApiResponse({ status: 200, type: UserPreferencesDto })
  getPreferences(@CurrentUser('userId') userId: string) {
    return this.userPreferencesService.getPreferences(userId);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update user preferences' })
  @ApiBody({ type: UpdateUserPreferencesDto })
  @ApiResponse({ status: 200, type: UserPreferencesDto })
  updatePreferences(@CurrentUser('userId') userId: string, @Body() dto: UpdateUserPreferencesDto) {
    return this.userPreferencesService.updatePreferences(userId, dto);
  }
}
