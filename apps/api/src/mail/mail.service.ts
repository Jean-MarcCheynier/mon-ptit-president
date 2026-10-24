import { Injectable, Logger } from '@nestjs/common';
import {
  type RenderedEmail,
  renderAccountExists,
  renderResetPassword,
  renderVerifyEmail,
} from '@presidency-bingo/emails';
import { DEFAULT_LOCALE, type Locale, localeSchema } from '@presidency-bingo/shared';
import { AppConfig } from '../config/app-config.service.js';
import { MailTransport } from './mail-transport.js';

interface Recipient {
  email: string;
  name: string;
  locale: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly transport: MailTransport,
    private readonly config: AppConfig,
  ) {}

  async sendVerificationEmail(to: Recipient, token: string) {
    const url = this.link('/verify-email', token);
    await this.deliver(to, await renderVerifyEmail({ ...this.params(to), url }));
  }

  async sendPasswordReset(to: Recipient, token: string) {
    const url = this.link('/reset-password', token);
    await this.deliver(to, await renderResetPassword({ ...this.params(to), url }));
  }

  async sendAccountExists(to: Recipient) {
    const url = `${this.config.get('APP_URL')}/login`;
    await this.deliver(to, await renderAccountExists({ ...this.params(to), url }));
  }

  private link(path: string, token: string) {
    return `${this.config.get('APP_URL')}${path}?token=${encodeURIComponent(token)}`;
  }

  private params(to: Recipient): { locale: Locale; name: string } {
    const locale = localeSchema.safeParse(to.locale);
    return { locale: locale.success ? locale.data : DEFAULT_LOCALE, name: to.name };
  }

  // Sent synchronously; a failure is logged rather than failing the request,
  // since every email can be re-requested (resend / forgot password).
  private async deliver(to: Recipient, email: RenderedEmail) {
    try {
      await this.transport.send({ to: to.email, ...email });
    } catch (error) {
      this.logger.error(`Failed to send "${email.subject}" to ${to.email}`, error);
    }
  }
}
