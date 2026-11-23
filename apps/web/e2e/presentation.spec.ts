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

  // On desktop, three slides are seen whole: the current one between its neighbours, which
  // stay out of the accessibility tree. Clicking a neighbour brings it to the center.
  const slides = page.locator('[aria-roledescription="diapositive"]');
  for (const i of [0, 1, 2]) await expect(slides.nth(i)).toBeInViewport({ ratio: 1 });
  await expect(slides.nth(3)).not.toBeInViewport({ ratio: 0.1 });
  await slides.nth(2).click();
  await expect(slide.getByRole('heading')).toHaveText('Le vainqueur');
  await slide.click();
  await expect(slide.getByRole('heading')).toHaveText('Le vainqueur');
  await slides.nth(1).click();
  await expect(slide.getByRole('heading')).toHaveText('Les qualifiés');

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

test('on desktop: the presentation centered on the screen, below the header', async ({ page }) => {
  const height = 1000;
  await page.setViewportSize({ width: 1280, height });
  await register(page);
  await expect(page.getByRole('heading', { name: 'Présentation du jeu' })).toBeVisible();

  const title = await page.getByRole('heading', { level: 1 }).boundingBox();
  const progress = await page
    .getByRole('list', { name: 'Avancement de la présentation' })
    .boundingBox();
  const header = await page.getByRole('banner').boundingBox();
  if (!title || !progress || !header) throw new Error('no presentation');
  const middle = (title.y + progress.y + progress.height) / 2;
  expect(Math.abs(middle - (header.y + header.height + height) / 2)).toBeLessThan(8);
});

test('on a phone: the slide centered between its peeking neighbours, swiped or tapped, without the bottom bar', async ({
  browser,
}) => {
  const height = 640;
  const context = await browser.newContext({
    viewport: { width: 360, height },
    hasTouch: true,
    isMobile: true,
    locale: 'fr-FR',
  });
  const page = await context.newPage();
  await register(page);

  const carousel = page.getByRole('region', { name: 'Présentation du jeu' });
  const heading = page.getByRole('article').getByRole('heading');
  await expect(heading).toHaveText('Bienvenue dans Mon p’tit président');
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Précédent' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Suivant' })).toBeHidden();

  const box = await carousel.boundingBox();
  if (!box) throw new Error('no carousel');
  expect(Math.abs(box.y + box.height / 2 - height / 2)).toBeLessThan(8);

  // The slide itself is centered too, its neighbour peeking.
  const slide = page.getByRole('article');
  const slideBox = await slide.boundingBox();
  if (!slideBox) throw new Error('no slide');
  expect(Math.abs(slideBox.x + slideBox.width / 2 - 360 / 2)).toBeLessThan(8);

  // Tapping the slide's right half moves on, the left half back.
  const tapSide = async (right: boolean) => {
    const current = await slide.boundingBox();
    if (!current) throw new Error('no slide');
    await slide.tap({ position: { x: right ? current.width - 20 : 20, y: current.height / 2 } });
  };
  await tapSide(true);
  await expect(heading).toHaveText('Les qualifiés');
  await tapSide(false);
  await expect(heading).toHaveText('Bienvenue dans Mon p’tit président');

  // Swiping to the left moves on, to the right back.
  const swipe = async (dx: number) => {
    const y = box.y + box.height / 2;
    const x = box.x + box.width / 2;
    await page.mouse.move(x - dx / 2, y);
    await page.mouse.down();
    await page.mouse.move(x + dx / 2, y, { steps: 5 });
    await page.mouse.up();
  };
  await swipe(-150);
  await expect(heading).toHaveText('Les qualifiés');
  await swipe(150);
  await expect(heading).toHaveText('Bienvenue dans Mon p’tit président');

  await expect(page.getByRole('button', { name: 'C’est parti !' })).toHaveCount(0);
  for (const title of ['Les qualifiés', 'Le vainqueur', 'Le 1er et le 2nd tour']) {
    await tapSide(true);
    await expect(heading).toHaveText(title);
  }
  await tapSide(true);
  await expect(heading).toHaveText('Clôture et classement');
  await page.getByRole('button', { name: 'C’est parti !' }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenue, Novice !' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
  await context.close();
});
