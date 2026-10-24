import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { ReactNode } from 'react';
import { APP_NAME } from '../messages.js';

interface ActionEmailProps {
  lang: string;
  preview: string;
  greeting: string;
  children: ReactNode;
  cta: string;
  url: string;
  linkFallback: string;
  footer: string;
}

export function ActionEmail(props: ActionEmailProps) {
  return (
    <Html lang={props.lang}>
      <Head />
      <Preview>{props.preview}</Preview>
      <Body style={{ backgroundColor: '#f4f4f5', fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <Container
          style={{
            backgroundColor: '#ffffff',
            padding: '32px',
            borderRadius: '8px',
            margin: '40px auto',
          }}
        >
          <Heading as="h1" style={{ fontSize: '20px' }}>
            {APP_NAME}
          </Heading>
          <Text>{props.greeting}</Text>
          {props.children}
          <Section style={{ margin: '24px 0' }}>
            <Button
              href={props.url}
              style={{
                backgroundColor: '#18181b',
                color: '#ffffff',
                padding: '12px 20px',
                borderRadius: '6px',
                fontWeight: 600,
              }}
            >
              {props.cta}
            </Button>
          </Section>
          <Text style={{ fontSize: '13px', color: '#52525b' }}>
            {props.linkFallback}
            <br />
            <Link href={props.url}>{props.url}</Link>
          </Text>
          <Hr />
          <Text style={{ fontSize: '12px', color: '#71717a' }}>{props.footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}
