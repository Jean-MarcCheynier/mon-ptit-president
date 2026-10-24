import type { Locale } from '@presidency-bingo/shared';

export const APP_NAME = 'Presidency Bingo';

const fr = {
  greeting: (name: string) => `Bonjour ${name},`,
  footer: `Si tu n'es pas à l'origine de cette demande, ignore simplement cet email.`,
  linkFallback: 'Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :',
  verifyEmail: {
    subject: 'Confirme ton adresse email',
    intro: `Merci de t'être inscrit sur ${APP_NAME} ! Confirme ton adresse email pour activer ton compte.`,
    cta: 'Confirmer mon email',
    expiry: 'Ce lien expire dans 24 heures.',
  },
  resetPassword: {
    subject: 'Réinitialise ton mot de passe',
    intro:
      'Tu as demandé à réinitialiser ton mot de passe. Clique sur le bouton ci-dessous pour en choisir un nouveau.',
    cta: 'Choisir un nouveau mot de passe',
    expiry: 'Ce lien expire dans 1 heure.',
  },
  accountExists: {
    subject: 'Tentative d’inscription avec ton adresse',
    intro: `Quelqu'un a essayé de créer un compte ${APP_NAME} avec ton adresse email, mais tu as déjà un compte.`,
    cta: 'Me connecter',
    hint: 'Mot de passe oublié ? Tu peux le réinitialiser depuis la page de connexion.',
  },
};

const en: typeof fr = {
  greeting: (name: string) => `Hi ${name},`,
  footer: `If you didn't request this, you can safely ignore this email.`,
  linkFallback: `If the button doesn't work, copy this link into your browser:`,
  verifyEmail: {
    subject: 'Confirm your email address',
    intro: `Thanks for signing up to ${APP_NAME}! Confirm your email address to activate your account.`,
    cta: 'Confirm my email',
    expiry: 'This link expires in 24 hours.',
  },
  resetPassword: {
    subject: 'Reset your password',
    intro: 'You asked to reset your password. Click the button below to choose a new one.',
    cta: 'Choose a new password',
    expiry: 'This link expires in 1 hour.',
  },
  accountExists: {
    subject: 'Sign-up attempt with your address',
    intro: `Someone tried to create a ${APP_NAME} account with your email address, but you already have one.`,
    cta: 'Sign in',
    hint: 'Forgot your password? You can reset it from the sign-in page.',
  },
};

export const messages: Record<Locale, typeof fr> = { fr, en };
