import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class UserPreferencesService {
  constructor(private prisma: PrismaService) {}

  async getPreferences(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });
    const prefs = (user?.preferences as Record<string, any>) || {};
    return {
      data: {
        accent_color: prefs.accent_color || 'cobalt',
        color_mode: prefs.color_mode || 'system',
        density: prefs.density || 'comfortable',
        email_on_new_reply: prefs.email_on_new_reply ?? true,
        email_on_status_change: prefs.email_on_status_change ?? true,
        email_on_mention: prefs.email_on_mention ?? true,
        email_digest: prefs.email_digest ?? false,
        browser_push: prefs.browser_push ?? true,
        email_on_ticket_assigned: prefs.email_on_ticket_assigned ?? true,
        email_on_sla_warning: prefs.email_on_sla_warning ?? true,
      },
    };
  }

  async updatePreferences(userId: string, dto: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });
    const current = (user?.preferences as Record<string, any>) || {};
    const updated = { ...current, ...dto };
    await this.prisma.user.update({
      where: { id: userId },
      data: { preferences: updated },
    });
    return this.getPreferences(userId);
  }
}
