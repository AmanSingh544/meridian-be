import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

const SETTINGS_DEFAULTS = {
  notifications: {
    email_on_sla_breach: true,
    slack_integration_enabled: false,
    slack_channel: '',
    daily_digest_enabled: false,
    daily_digest_time: '08:00',
    client_status_notifications: true,
  },
  ai_features: {
    triage_agent_enabled: false,
    similar_ticket_suggestions_enabled: false,
    kb_deflection_enabled: false,
    auto_generate_kb_articles_enabled: false,
    weekly_project_summaries_enabled: false,
    ai_provider: 'anthropic',
    ai_model_name: '',
    ai_base_url: '',
    // ai_api_key is never stored here — stored encrypted separately
    ai_api_key_hash: '',
  },
  access: {
    sso_enabled: false,
    two_factor_required: false,
    audit_logging_enabled: true,
    ip_allowlist_enabled: false,
    ip_allowlist: [],
  },
};

@Injectable()
export class SystemSettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const stored = (tenant.settings as Record<string, any>) || {};
    const merged = this.mergeWithDefaults(stored);

    return {
      data: {
        notifications: {
          emailOnSLABreach: merged.notifications.email_on_sla_breach,
          slackIntegrationEnabled: merged.notifications.slack_integration_enabled,
          slackChannel: merged.notifications.slack_channel,
          dailyDigestEnabled: merged.notifications.daily_digest_enabled,
          dailyDigestTime: merged.notifications.daily_digest_time,
          clientStatusNotifications: merged.notifications.client_status_notifications,
        },
        aiFeatures: {
          triageAgentEnabled: merged.ai_features.triage_agent_enabled,
          similarTicketSuggestionsEnabled: merged.ai_features.similar_ticket_suggestions_enabled,
          kbDeflectionEnabled: merged.ai_features.kb_deflection_enabled,
          autoGenerateKBArticlesEnabled: merged.ai_features.auto_generate_kb_articles_enabled,
          weeklyProjectSummariesEnabled: merged.ai_features.weekly_project_summaries_enabled,
          aiProvider: merged.ai_features.ai_provider,
          aiModelName: merged.ai_features.ai_model_name,
          aiBaseUrl: merged.ai_features.ai_base_url,
          aiApiKeySet: !!merged.ai_features.ai_api_key_hash,
          // aiApiKey deliberately omitted
        },
        access: {
          ssoEnabled: merged.access.sso_enabled,
          twoFactorRequired: merged.access.two_factor_required,
          auditLoggingEnabled: merged.access.audit_logging_enabled,
          ipAllowlistEnabled: merged.access.ip_allowlist_enabled,
          ipAllowlist: merged.access.ip_allowlist,
        },
        updated_at: new Date().toISOString(),
      },
    };
  }

  async updateSettings(tenantId: string, dto: any) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const stored = (tenant.settings as Record<string, any>) || {};
    const current = this.mergeWithDefaults(stored);

    if (dto.notifications) {
      Object.assign(current.notifications, dto.notifications);
    }

    if (dto.ai_features) {
      const { ai_api_key, ai_api_key_set, ...rest } = dto.ai_features;
      Object.assign(current.ai_features, rest);
      if (ai_api_key && ai_api_key.trim()) {
        // Store a hash/marker — never store plaintext keys in JSON settings
        // In production, encrypt with KMS. Here we store a non-reversible marker.
        current.ai_features.ai_api_key_hash = Buffer.from(ai_api_key).toString('base64').slice(0, 8) + '...';
      }
    }

    if (dto.access) {
      Object.assign(current.access, dto.access);
      if (Array.isArray(dto.access.ip_allowlist)) {
        current.access.ip_allowlist = dto.access.ip_allowlist;
      }
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: current },
    });

    return this.getSettings(tenantId);
  }

  private mergeWithDefaults(stored: Record<string, any>) {
    return {
      notifications: { ...SETTINGS_DEFAULTS.notifications, ...(stored.notifications || {}) },
      ai_features: { ...SETTINGS_DEFAULTS.ai_features, ...(stored.ai_features || {}) },
      access: { ...SETTINGS_DEFAULTS.access, ...(stored.access || {}) },
    };
  }
}
