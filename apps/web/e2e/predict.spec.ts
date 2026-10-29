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

/** Drags the card horizontally with the mouse and releases it. */
async function dragCard(page: Page, dx: number) {
  const box = await page.getByTestId('swipe-card').boundingBox();
  if (!box) throw new Error('No card to drag');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y, { steps: 15 });
  await page.mouse.up();
}

/** Makes the API report the predictions as locked, as after the deadline. */
async function lockPredictions(page: Page) {
  await page.route('**/api/elections/current', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...(await response.json()), predictionsLocked: true },
    });
  });
}

test('swipe with the keyboard and the mouse, survive a reload, undo, resume from home', async ({
  page,
}) => {
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

  await expect(progress(page)).toHaveText(/^1 \//);

  // Dragging: a short drag springs back, a long one decides.
  const card = await page.getByRole('heading', { level: 2 }).textContent();
  await dragCard(page, 40);
  await page.waitForTimeout(500); // nothing should happen: give it the time to
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(card ?? '');
  await expect(progress(page)).toHaveText(/^1 \//);
  await dragCard(page, 200);
  await expect(progress(page)).toHaveText(/^2 \//);
  await dragCard(page, -200);
  await expect(progress(page)).toHaveText(/^3 \//);

  // Without animations, keys and drags decide at once.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('ArrowLeft');
  await expect(progress(page)).toHaveText(/^4 \//);
  await dragCard(page, 200);
  await expect(progress(page)).toHaveText(/^5 \//);

  await page.getByRole('link', { name: 'Accueil' }).click();
  await expect(
    page.getByRole('link', { name: /Reprendre ton brouillon \(5\/\d+\)/ }),
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

  // After the deadline, the bet is read-only.
  await lockPredictions(page);
  await page.goto('/');
  await expect(page.getByText('Pronostics clos', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Modifier' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Voir mon pronostic' }).click();
  await expect(page.getByText(/^Pronostics clos\. Voici ton pronostic/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Qualifiés (3)' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Passer .* en / })).toHaveCount(0);
  await page.goto('/review');
  await expect(page).toHaveURL(/\/predict$/);
});

test('after the deadline, a user who never validated cannot take part', async ({ page }) => {
  await signUp(page);
  await lockPredictions(page);
  await page.reload();
  await expect(page.getByText('Pronostics clos, tu n’as pas participé.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Fais ton pronostic' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Mon pronostic' }).click();
  await expect(page.getByText('Pronostics clos, tu n’as pas participé.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Qualifié' })).toHaveCount(0);
});

test('a page opened before the deadline turns read-only on the next action', async ({ page }) => {
  await signUp(page);
  await page.getByRole('link', { name: 'Fais ton pronostic' }).click();
  await expect(page.getByRole('button', { name: 'Qualifié' })).toBeVisible();

  // The deadline passes while the page is open (as seen by the server).
  await lockPredictions(page);
  await page.route('**/api/elections/current/draft/entries/*', (route) =>
    route.fulfill({
      status: 403,
      json: { statusCode: 403, code: 'PREDICTIONS_LOCKED', message: 'Locked' },
    }),
  );
  await page.keyboard.press('ArrowRight');

  await expect(page.getByText('Pronostics clos, tu n’as pas participé.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Qualifié' })).toHaveCount(0);
});
