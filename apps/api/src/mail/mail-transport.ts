export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** How emails leave the app. Swap the implementation without touching MailService. */
export abstract class MailTransport {
  abstract send(message: MailMessage): Promise<void>;
}
