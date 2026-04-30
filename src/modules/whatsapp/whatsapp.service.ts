import { Injectable, Logger } from '@nestjs/common';

export interface SendWhatsAppParams {
  to: string; // phone number in E.164 format, e.g. +919876543210
  templateName: string;
  params?: Record<string, string>;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly enabled: boolean;

  constructor() {
    // WhatsApp is only available on Brevo Business+ plans and requires
    // Meta Business API approval. Keep disabled until ready.
    this.enabled = process.env.BREVO_WHATSAPP_ENABLED === 'true';
  }

  async send(params: SendWhatsAppParams): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(
        `WhatsApp not enabled — skipping message to ${params.to} (template: ${params.templateName})`,
      );
      return;
    }

    // TODO: Implement Brevo Conversations API call when ready.
    // Brevo endpoint: POST /conversations/messages
    // Requires: BREVO_API_KEY + WhatsApp channel configured in Brevo dashboard.
    this.logger.warn(`WhatsApp send not yet implemented — message to ${params.to} dropped`);
  }
}
