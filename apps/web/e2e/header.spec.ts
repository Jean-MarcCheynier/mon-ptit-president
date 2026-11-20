import { expect, type Page, test } from '@playwright/test';
import { linkFromLatestEmail } from './mailpit';

// Requires the seeded election and its favorites (`pnpm --filter @presidency-bingo/api db:seed`):
// a new player has the qualifiers to do, the winner and the first round ahead.

async function signUp(page: Page) {
  const email = `header+${Date.now()}@example.com`;
  await page.goto('/register');
  await page.getByLabel('Nom').fill('Header');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill('correct horse battery');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByText('Vérifie ta boîte mail')).toBeVisible();
  await page.goto(await linkFromLatestEmail(email, '/verify-email'));
  await expect(page.getByRole('heading', { name: 'Bienvenue, Header !' })).toBeVisible();
}

test('the desktop header lists each phase, greying out those ahead', async ({ page }) => {
  await signUp(page);
  const header = page.getByRole('banner');
  const entries = header.getByRole('navigation').locator('a, button');
  await expect(entries).toHaveText(['Accueil', 'Qualifiés', 'Vainqueur', '1er tour', 'Paramètres']);
  await expect(header.getByRole('link', { name: 'Accueil' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  // Ahead: kept in place, not a link, with a tooltip.
  const winner = header.getByRole('button', { name: 'Vainqueur' });
  await expect(winner).toHaveAttribute('aria-disabled', 'true');
  await expect(header.getByRole('link', { name: 'Vainqueur' })).toHaveCount(0);
  await winner.hover();
  await expect(page.getByRole('tooltip', { name: 'À venir' })).toBeVisible();
  await winner.click({ force: true });
  await expect(page).toHaveURL(/\/$/);

  // Each phase carries its state's color.
  const qualifiers = header.getByRole('link', { name: 'Qualifiés' });
  await expect(qualifiers.locator('.bg-phase-todo')).toHaveCount(1);
  await expect(winner.locator('.bg-phase-upcoming')).toHaveCount(1);

  await qualifiers.click();
  await expect(page).toHaveURL(/\/predict$/);
  await expect(qualifiers).toHaveAttribute('aria-current', 'page');
  await expect(header.getByRole('link', { name: 'Accueil' })).not.toHaveAttribute(
    'aria-current',
    'page',
  );

  // From the narrowest desktop width, on one line.
  await page.setViewportSize({ width: 640, height: 800 });
  const box = await header.boundingBox();
  expect(box?.height).toBeLessThanOrEqual(57);
  const overflow = await header
    .getByRole('navigation')
    .evaluate((nav) => nav.scrollWidth - nav.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
