import { Module } from '@nestjs/common';
import { MailService } from './mail.service.js';
import { MailTransport } from './mail-transport.js';
import { SmtpTransport } from './smtp.transport.js';

@Module({
  providers: [MailService, { provide: MailTransport, useClass: SmtpTransport }],
  exports: [MailService],
})
export class MailModule {}
