import { Injectable } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { AppConfig } from '../config/app-config.service.js';
import { type MailMessage, MailTransport } from './mail-transport.js';

/** Works with Mailpit (dev), Gmail app passwords, Resend, Brevo… any SMTP server. */
@Injectable()
export class SmtpTransport implements MailTransport {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: AppConfig) {
    const user = config.get('SMTP_USER');
    this.from = config.get('MAIL_FROM');
    this.transporter = createTransport({
      host: config.get('SMTP_HOST'),
      port: config.get('SMTP_PORT'),
      secure: config.get('SMTP_SECURE'),
      auth: user ? { user, pass: config.get('SMTP_PASS') } : undefined,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.from, ...message });
  }
}
