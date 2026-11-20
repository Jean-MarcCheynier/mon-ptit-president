import { expect, type Page, test } from '@playwright/test';
import { linkFromLatestEmail } from './mailpit';

// Requires the seeded election (`pnpm --filter @presidency-bingo/api db:seed`).

async function register(page: Page) {
  const email = `presentation+${Date.now()}@example.com`;
  await page.goto('/register');
  await page.getByLabel('Nom').fill('Novice');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill('correct horse battery');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByText('Vérifie ta boîte mail')).toBeVisible();
  await page.goto(await linkFromLatestEmail(email, '/verify-email'));
}

/** A step of the journey, on the home page. */
const step = (page: Page, name: string) =>
  page.getByRole('list', { name: 'Ton parcours' }).getByRole('listitem').filter({ hasText: name });

test('a new player goes through the presentation before the qualifiers', async ({ page }) => {
  await register(page);
  const heading = page.getByRole('heading', { name: 'Présentation du jeu' });
  await expect(heading).toBeVisible();

  // The qualifiers wait for it.
  await page.goto('/predict');
  await expect(heading).toBeVisible();

  const slide = page.getByRole('article');
  await expect(slide).toHaveAccessibleName('1 sur 5');
  await expect(slide.getByRole('heading')).toHaveText('Bienvenue dans Mon p’tit président');
  await expect(page.getByRole('button', { name: 'Précédent' })).toBeDisabled();
  await page.getByRole('button', { name: 'Suivant' }).click();
  await expect(slide.getByRole('heading')).toHaveText('Les qualifiés');
  await expect(slide).toContainText('100 points');

  // The arrow keys move too, and the dots jump to a slide.
  await page.getByRole('region', { name: 'Présentation du jeu' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(slide.getByRole('heading')).toHaveText('Le vainqueur');
  await page.keyboard.press('ArrowLeft');
  await expect(slide.getByRole('heading')).toHaveText('Les qualifiés');
  await page.getByRole('button', { name: '5 sur 5' }).click();
  await expect(slide.getByRole('heading')).toHaveText('Clôture et classement');
  await expect(page.getByRole('button', { name: 'Passer' })).toHaveCount(0);

  await page.getByRole('button', { name: 'C’est parti !' }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenue, Novice !' })).toBeVisible();
  await expect(step(page, 'Présentation')).toContainText('Faite');
  await expect(page.getByText('La présentation du jeu a changé')).toHaveCount(0);

  // Still there to read again, from the journey and the settings, without blocking anything.
  await step(page, 'Présentation').getByRole('link', { name: 'Revoir la présentation' }).click();
  await expect(heading).toBeVisible();
  await page.goto('/settings');
  await page.getByRole('link', { name: 'Revoir la présentation' }).click();
  await expect(heading).toBeVisible();
  await page.goto('/predict');
  await expect(page.getByRole('heading', { name: 'Mon pronostic' })).toBeVisible();
});

test('skipping counts as done', async ({ page }) => {
  await register(page);
  await page.getByRole('button', { name: 'Passer' }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenue, Novice !' })).toBeVisible();
  await step(page, 'Qualifiés')
    .getByRole('link', { name: /^Fais ton prono !/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Mon pronostic' })).toBeVisible();
});

test('a new version of the presentation is proposed, not imposed', async ({ page }) => {
  await register(page);
  await page.getByRole('button', { name: 'Passer' }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenue, Novice !' })).toBeVisible();

  // As after a bump of ONBOARDING_VERSION: the version seen is older.
  await page.route('**/api/me', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...(await response.json()), onboardingVersionSeen: 0 },
    });
  });
  await page.reload();
  await expect(page.getByText('La présentation du jeu a changé')).toBeVisible();
  await expect(
    step(page, 'Qualifiés').getByRole('link', { name: /^Fais ton prono !/ }),
  ).toBeVisible();

  await page.unroute('**/api/me');
  await page.getByRole('button', { name: 'Plus tard' }).click();
  await expect(page.getByText('La présentation du jeu a changé')).toHaveCount(0);
});
