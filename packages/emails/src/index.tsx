import type { Locale } from '@presidency-bingo/shared';
import { render, Text } from '@react-email/components';
import type { ReactElement } from 'react';
import { messages } from './messages.js';
import { ActionEmail } from './templates/layout.js';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface EmailParams {
  locale: Locale;
  name: string;
  url: string;
}

async function toEmail(subject: string, element: ReactElement): Promise<RenderedEmail> {
  return {
    subject,
    html: await render(element),
    text: await render(element, { plainText: true }),
  };
}

export function renderVerifyEmail({ locale, name, url }: EmailParams) {
  const m = messages[locale];
  return toEmail(
    m.verifyEmail.subject,
    <ActionEmail
      lang={locale}
      preview={m.verifyEmail.subject}
      greeting={m.greeting(name)}
      cta={m.verifyEmail.cta}
      url={url}
      linkFallback={m.linkFallback}
      footer={m.footer}
    >
      <Text>{m.verifyEmail.intro}</Text>
      <Text>{m.verifyEmail.expiry}</Text>
    </ActionEmail>,
  );
}

export function renderResetPassword({ locale, name, url }: EmailParams) {
  const m = messages[locale];
  return toEmail(
    m.resetPassword.subject,
    <ActionEmail
      lang={locale}
      preview={m.resetPassword.subject}
      greeting={m.greeting(name)}
      cta={m.resetPassword.cta}
      url={url}
      linkFallback={m.linkFallback}
      footer={m.footer}
    >
      <Text>{m.resetPassword.intro}</Text>
      <Text>{m.resetPassword.expiry}</Text>
    </ActionEmail>,
  );
}

export function renderAccountExists({ locale, name, url }: EmailParams) {
  const m = messages[locale];
  return toEmail(
    m.accountExists.subject,
    <ActionEmail
      lang={locale}
      preview={m.accountExists.subject}
      greeting={m.greeting(name)}
      cta={m.accountExists.cta}
      url={url}
      linkFallback={m.linkFallback}
      footer={m.footer}
    >
      <Text>{m.accountExists.intro}</Text>
      <Text>{m.accountExists.hint}</Text>
    </ActionEmail>,
  );
}
