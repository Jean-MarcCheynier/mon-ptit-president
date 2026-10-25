import { expect, test } from '@playwright/test';
import { linkFromLatestEmail } from './mailpit';

test('register → confirm email → sign out → sign in', async ({ page }) => {
  const email = `ada+${Date.now()}@example.com`;
  const password = 'correct horse battery';

  await page.goto('/register');
  await page.getByLabel('Nom').fill('Ada');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByText('Vérifie ta boîte mail')).toBeVisible();

  // Signing in before confirming is refused.
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByText('Confirme ton adresse email avant de te connecter.')).toBeVisible();

  // The link in the email confirms the address and signs in.
  await page.goto(await linkFromLatestEmail(email, '/verify-email'));
  await expect(page.getByRole('heading', { name: 'Bienvenue, Ada !' })).toBeVisible();

  await page.getByRole('button', { name: 'Déconnexion' }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenue, Ada !' })).toBeVisible();

  // Protected pages send anonymous visitors to /login.
  await page.context().clearCookies();
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/login\?redirect=/);
});
