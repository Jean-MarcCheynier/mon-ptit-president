import { expect, type Page, test } from '@playwright/test';
import { linkFromLatestEmail } from './mailpit';

// Requires the seeded election and its favorites (`pnpm --filter @presidency-bingo/api db:seed`).
// Opening the winner's phase takes validated qualifiers, too long to swipe here: the phases say it
// is reachable, and the winner's draft and ballot are served from memory with the API's rules.
// The favorites come from the API.

async function signUp(page: Page) {
  const email = `winner+${Date.now()}@example.com`;
  await page.goto('/register');
  await page.getByLabel('Nom').fill('Winner');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill('correct horse battery');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByText('Vérifie ta boîte mail')).toBeVisible();
  await page.goto(await linkFromLatestEmail(email, '/verify-email'));
  await expect(page.getByRole('heading', { name: 'Bienvenue, Winner !' })).toBeVisible();
}

async function openWinner(page: Page) {
  let draft: string | null = null;
  let ballot: { validatedAt: string; favoriteId: string } | null = null;

  // Qualifiers validated, the winner reachable, done once validated.
  await page.route('**/api/elections/current/phases', async (route) => {
    const response = await route.fetch();
    const { phases } = (await response.json()) as { phases: { phase: string }[] };
    await route.fulfill({
      response,
      json: {
        phases: phases.map((p) =>
          p.phase === 'QUALIFIERS'
            ? { ...p, state: 'DONE' }
            : p.phase === 'WINNER'
              ? { ...p, playable: true, state: ballot ? 'DONE' : 'TODO' }
              : p,
        ),
      },
    });
  });

  await page.route('**/api/elections/current/winner/{draft,ballot,draft/validate}', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/elections/current/winner', '');
    const json = (body: unknown) => route.fulfill({ json: body });

    if (path === '/ballot') return json({ ballot, points: null });
    if (path === '/draft' && request.method() === 'GET') return json({ favoriteId: draft });
    if (path === '/draft') {
      draft = request.postDataJSON().favoriteId as string;
      return json({ favoriteId: draft });
    }
    if (!draft) return route.fulfill({ status: 422, json: { code: 'BALLOT_INCOMPLETE' } });
    ballot = { validatedAt: new Date().toISOString(), favoriteId: draft };
    draft = null;
    return json(ballot);
  });
}

test('pick a favorite with its odds, validate, change it from home', async ({ page }) => {
  await openWinner(page);
  await signUp(page);
  await page.getByRole('link', { name: 'Pronostique le vainqueur' }).click();
  await expect(page.getByRole('heading', { name: 'Pronostic du vainqueur' })).toBeVisible();

  const choices = page.getByRole('radio');
  await expect(choices).toHaveCount(8);
  await expect(choices.first()).toContainText('Marine Le Pen');
  await expect(choices.first()).toContainText('90 pts');
  await expect(choices.last()).toContainText('Autre candidat');

  const validate = page.getByRole('button', { name: 'Valider mon pronostic' });
  await expect(validate).toBeDisabled();
  const glucksmann = page.getByRole('radio', { name: /Raphaël Glucksmann/ });
  await glucksmann.click();
  await expect(glucksmann).toHaveAttribute('aria-checked', 'true');
  await validate.click();

  await expect(page.getByText('Ton pronostic du vainqueur est validé')).toBeVisible();
  await expect(page.getByText('Raphaël Glucksmann', { exact: true })).toBeVisible();

  // From the journey: still editable, the winner offers to edit, straight into the choices.
  await page.goto('/');
  await page.getByRole('link', { name: 'Modifier' }).click();
  await expect(glucksmann).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText(/Ton pronostic reste celui validé le/)).toBeVisible();
  await page.getByRole('radio', { name: /Autre candidat/ }).click();
  await validate.click();
  await expect(page.getByText('Ton pronostic du vainqueur est validé')).toBeVisible();
  await expect(page.getByText('Autre candidat', { exact: true })).toBeVisible();
});
