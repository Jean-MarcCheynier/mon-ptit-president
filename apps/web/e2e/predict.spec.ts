import { expect, type Page, test } from '@playwright/test';
import { linkFromLatestEmail } from './mailpit';

// Requires the seeded election (`pnpm --filter @presidency-bingo/api db:seed`).

async function signUp(page: Page) {
  const email = `swiper+${Date.now()}@example.com`;
  await page.goto('/register');
  await page.getByLabel('Nom').fill('Swiper');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill('correct horse battery');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByText('Vérifie ta boîte mail')).toBeVisible();
  await page.goto(await linkFromLatestEmail(email, '/verify-email'));
  await expect(page.getByRole('heading', { name: 'Bienvenue, Swiper !' })).toBeVisible();
}

const progress = (page: Page) => page.getByText(/^\d+ \/ \d+$/);

test('swipe with the keyboard, survive a reload, undo, resume from home', async ({ page }) => {
  await signUp(page);
  await page.getByRole('link', { name: 'Fais ton pronostic' }).click();
  await expect(page.getByRole('heading', { name: 'Mon pronostic' })).toBeVisible();
  await expect(progress(page)).toHaveText(/^0 \//);

  const first = await page.getByRole('heading', { level: 2 }).textContent();
  await page.keyboard.press('ArrowRight');
  await expect(progress(page)).toHaveText(/^1 \//);
  await expect(page.getByRole('heading', { level: 2 })).not.toHaveText(first ?? '');
  await page.keyboard.press('ArrowLeft');
  await expect(progress(page)).toHaveText(/^2 \//);

  // Saved on the server: a reload keeps both decisions.
  await page.reload();
  await expect(progress(page)).toHaveText(/^2 \//);

  await page.keyboard.press('Backspace');
  await expect(progress(page)).toHaveText(/^1 \//);
  await page.keyboard.press('Backspace');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(first ?? '');
  await page.keyboard.press('ArrowRight');

  await page.getByRole('link', { name: 'Accueil' }).click();
  await expect(
    page.getByRole('link', { name: /Reprendre ton brouillon \(1\/\d+\)/ }),
  ).toBeVisible();
});

test('swipe everything, review, validate, then edit the bet', async ({ page }) => {
  await signUp(page);
  await page.getByRole('link', { name: 'Fais ton pronostic' }).click();
  const total = Number((await progress(page).textContent())?.split('/')[1]);

  // Keep only the first candidate: not enough to validate yet.
  for (let decided = 0; decided < total; decided++) {
    await page.keyboard.press(decided === 0 ? 'ArrowRight' : 'ArrowLeft');
    await expect(progress(page)).toHaveText(`${decided + 1} / ${total}`);
  }
  await page.getByRole('link', { name: 'Passer à la revue' }).click();

  await expect(page.getByRole('heading', { name: 'Revue de ton pronostic' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Qualifiés (1)' })).toBeVisible();
  const validate = page.getByRole('button', { name: 'Valider mon pronostic' });
  await expect(validate).toBeDisabled();
  await expect(page.getByText('Retiens au moins 2 candidats qualifiés')).toBeVisible();

  await page
    .getByRole('button', { name: /en qualifié$/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Qualifiés (2)' })).toBeVisible();
  await validate.click();

  await expect(page.getByRole('heading', { name: /^Bienvenue/ })).toBeVisible();
  await expect(page.getByText(/^Pronostic validé le/)).toBeVisible();

  // Editing starts from the bet, which stays current until revalidated.
  await page.getByRole('button', { name: 'Modifier' }).click();
  await expect(page.getByRole('heading', { name: 'Qualifiés (2)' })).toBeVisible();
  await expect(page.getByText(/^Ton pari reste celui validé le/)).toBeVisible();
  await page
    .getByRole('button', { name: /en qualifié$/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Qualifiés (3)' })).toBeVisible();

  await page.getByRole('link', { name: 'Accueil' }).click();
  await page.getByRole('link', { name: 'Reprendre ta modification' }).click();
  await expect(page.getByRole('heading', { name: 'Qualifiés (3)' })).toBeVisible();
  await page.getByRole('button', { name: 'Valider mon pronostic' }).click();
  await expect(page.getByRole('button', { name: 'Modifier' })).toBeVisible();

  await page.getByRole('link', { name: 'Mon pronostic' }).click();
  await expect(page.getByText('Ton pronostic est validé')).toBeVisible();
});
