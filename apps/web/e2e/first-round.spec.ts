import { expect, type Page, test } from '@playwright/test';
import { linkFromLatestEmail } from './mailpit';

// Requires the seeded election (`pnpm --filter @presidency-bingo/api db:seed`). The seed doesn't
// publish the official list, so the first round is opened by faking the API: the election says
// the phase is open with three qualified candidates, and the first-round routes are served from
// memory with the API's rules.

async function signUp(page: Page) {
  const email = `scorer+${Date.now()}@example.com`;
  await page.goto('/register');
  await page.getByLabel('Nom').fill('Scorer');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill('correct horse battery');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByText('Vérifie ta boîte mail')).toBeVisible();
  await page.goto(await linkFromLatestEmail(email, '/verify-email'));
  await expect(page.getByRole('heading', { name: 'Bienvenue, Scorer !' })).toBeVisible();
}

interface Entry {
  politicianId: string;
  score: number;
}

async function openFirstRound(page: Page) {
  const DAY = 24 * 60 * 60 * 1000;
  let qualified: string[] = [];
  let draft: Entry[] | null = null;
  let ballot: { validatedAt: string; entries: Entry[] } | null = null;

  await page.route('**/api/elections/current', async (route) => {
    const response = await route.fetch();
    const election = await response.json();
    const candidates = election.candidates.map((c: { politicianId: string }, i: number) => ({
      ...c,
      status: i < 3 ? 'QUALIFIED' : 'NOT_QUALIFIED',
    }));
    qualified = candidates.slice(0, 3).map((c: { politicianId: string }) => c.politicianId);
    await route.fulfill({
      response,
      json: {
        ...election,
        candidates,
        firstRound: {
          opensAt: new Date(Date.now() - DAY).toISOString(),
          closesAt: new Date(Date.now() + 10 * DAY).toISOString(),
          status: 'OPEN',
        },
      },
    });
  });

  await page.route('**/api/elections/current/first-round/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/elections/current/first-round', '');
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });

    if (path === '/ballot') return json({ ballot });
    if (path === '/draft' && method === 'GET') return json({ entries: draft ?? [] });
    if (path === '/draft' && method === 'POST') {
      draft ??= ballot ? [...ballot.entries] : [];
      return json({ entries: draft });
    }
    if (path === '/draft/validate') {
      // Like the API: a candidate without a score counts as 0 %, and the sum is free.
      const entries = qualified.map(
        (politicianId) =>
          draft?.find((e) => e.politicianId === politicianId) ?? { politicianId, score: 0 },
      );
      ballot = { validatedAt: new Date().toISOString(), entries };
      draft = null;
      return json(ballot);
    }
    const politicianId = path.replace('/draft/entries/', '');
    draft ??= ballot ? [...ballot.entries] : [];
    draft = draft.filter((e) => e.politicianId !== politicianId);
    if (method === 'DELETE') return route.fulfill({ status: 204 });
    const entry = { politicianId, score: request.postDataJSON().score as number };
    draft.push(entry);
    return json(entry);
  });
}

test('share out the scores with sliders and fields, survive a reload, validate, edit', async ({
  page,
}) => {
  await openFirstRound(page);
  await signUp(page);
  await page.getByRole('link', { name: 'Pronostique le 1er tour' }).click();
  await expect(page.getByRole('heading', { name: 'Pronostic du 1er tour' })).toBeVisible();

  const fields = page.getByRole('textbox', { name: /^Score de / });
  const sliders = page.getByRole('slider', { name: /^Score de / });
  await expect(fields).toHaveCount(3);
  await expect(sliders).toHaveCount(3);
  await expect(fields.nth(2)).toHaveValue('0');
  const validate = page.getByRole('button', { name: 'Valider mon pronostic' });
  await expect(page.getByText('Reste à répartir : 100,0 %')).toBeVisible();

  await fields.nth(0).fill('45,5');
  await fields.nth(1).fill('30');
  await fields.nth(1).blur();
  await expect(sliders.nth(0)).toHaveAttribute('aria-valuenow', '455');
  await expect(page.getByText('Reste à répartir : 24,5 %')).toBeVisible();

  // The slider: one keyboard step is 0.1 point, saved at once.
  await sliders.nth(1).press('ArrowRight');
  await expect(fields.nth(1)).toHaveValue('30,1');

  // Saved: a reload keeps the scores.
  await page.reload();
  await expect(fields.nth(0)).toHaveValue('45,5');
  await expect(fields.nth(1)).toHaveValue('30,1');

  await fields.nth(2).fill('30');
  await expect(page.getByText('Total dépassé de 5,6 %')).toBeVisible();
  // The total is only a guide: validating is allowed anyway.
  await fields.nth(2).fill('10');
  await validate.click();

  await expect(page.getByText('Ton pronostic du 1er tour est validé')).toBeVisible();
  await expect(page.getByText('45,5 %')).toBeVisible();

  await page.getByRole('button', { name: 'Modifier' }).click();
  await expect(fields.nth(0)).toHaveValue('45,5');
  await expect(page.getByText(/Ton pronostic reste celui validé le/)).toBeVisible();
});
