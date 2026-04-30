import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoClient } from '@getbrevo/brevo';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private readonly brevoClient: BrevoClient;
  private readonly smtpTransporter: Transporter;
  private readonly from: string;
  private readonly fromName: string;
  private readonly logger = new Logger(EmailService.name);

  constructor(private config: ConfigService) {
    // Brevo REST API client (v5)
    const apiKey = this.config.get<string>('BREVO_API_KEY');
    if (!apiKey) {
      this.logger.warn('BREVO_API_KEY is not set. Email sending will fail.');
    }
    this.brevoClient = new BrevoClient({ apiKey: apiKey ?? '' });

    // SMTP fallback transporter
    const smtpKey = this.config.get<string>('BREVO_SMTP_KEY');
    this.smtpTransporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: this.config.get<string>('BREVO_SMTP_USER', ''),
        pass: smtpKey ?? '',
      },
    });

    this.from = this.config.get<string>('EMAIL_FROM', 'noreply@brevosend.com');
    this.fromName = this.config.get<string>('EMAIL_FROM_NAME', '3SC Platform');
  }

  async send(params: SendEmailParams): Promise<void> {
    const { to, subject, html } = params;

    try {
      // 1. Try Brevo REST API first
      await this.sendViaApi(to, subject, html);
      this.logger.log(`Email sent via Brevo API to ${to}: "${subject}"`);
    } catch (apiErr) {
      this.logger.warn(
        `Brevo API failed for ${to}: ${(apiErr as Error).message}. Retrying via SMTP...`,
      );

      try {
        // 2. Fallback to SMTP relay
        await this.sendViaSmtp(to, subject, html);
        this.logger.log(`Email sent via Brevo SMTP to ${to}: "${subject}"`);
      } catch (smtpErr) {
        this.logger.error(
          `Brevo SMTP also failed for ${to}: ${(smtpErr as Error).message}`,
        );
        throw smtpErr; // re-throw so BullMQ can retry
      }
    }
  }

  private async sendViaApi(to: string, subject: string, html: string): Promise<void> {
    const response = await this.brevoClient.transactionalEmails.sendTransacEmail({
      subject,
      htmlContent: html,
      sender: { name: this.fromName, email: this.from },
      to: [{ email: to }],
    });
    this.logger.debug(`Brevo API messageId: ${response.messageId}`);
  }

  private async sendViaSmtp(to: string, subject: string, html: string): Promise<void> {
    await this.smtpTransporter.sendMail({
      from: `"${this.fromName}" <${this.from}>`,
      to,
      subject,
      html,
    });
  }
}
