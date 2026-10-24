import { Injectable } from '@nestjs/common';
import { type MailMessage, MailTransport } from './mail-transport.js';

/** Test double: keeps sent emails in memory. */
@Injectable()
export class InMemoryMailTransport implements MailTransport {
  readonly sent: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }

  lastTo(email: string): MailMessage | undefined {
    return this.sent.findLast((message) => message.to === email);
  }

  clear() {
    this.sent.length = 0;
  }
}
