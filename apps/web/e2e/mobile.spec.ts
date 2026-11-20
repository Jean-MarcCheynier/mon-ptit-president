import { type Browser, expect, type Page, test } from '@playwright/test';
import { linkFromLatestEmail } from './mailpit';
import { skipPresentation } from './presentation';

type Screen = { name: string; width: number; height: number; touch: boolean };

/** Phones in portrait and landscape: bottom bar, no header. */
const PHONE: Screen = { name: 'phone', width: 360, height: 640, touch: true };
const PHONES: Screen[] = [
  { name: 'small phone', width: 320, height: 568, touch: true },
  PHONE,
  { name: 'large phone', width: 390, height: 844, touch: true },
  { name: 'phone in landscape', width: 844, height: 390, touch: true },
];
const DESKTOP: Screen = { name: 'desktop', width: 1280, height: 800, touch: false };

/** Signs a new player up and returns their session, to reuse across screen sizes. */
async function signUp(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = `mobile+${Date.now()}@example.com`;
  await page.goto('/register');
  await page.getByLabel('Nom').fill('Mobile');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill('correct horse battery');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByText('Vérifie ta boîte mail')).toBeVisible();
  await page.goto(await linkFromLatestEmail(email, '/verify-email'));
  await skipPresentation(page);
  await expect(page.getByRole('heading', { name: 'Bienvenue, Mobile !' })).toBeVisible();
  const state = await context.storageState();
  await context.close();
  return state;
}

async function open(
  browser: Browser,
  screen: Screen,
  storageState: Awaited<ReturnType<typeof signUp>>,
) {
  const context = await browser.newContext({
    storageState,
    viewport: { width: screen.width, height: screen.height },
    hasTouch: screen.touch,
    isMobile: screen.touch,
    locale: 'fr-FR',
  });
  return context.newPage();
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test('phones get a bottom bar instead of the header; desktop keeps the header', async ({
  browser,
}) => {
  // Four phones and a desktop, each walked through: more than the default 30s on a busy machine.
  test.setTimeout(60_000);
  const session = await signUp(browser);

  for (const screen of PHONES) {
    await test.step(screen.name, async () => {
      const page = await open(browser, screen, session);
      await page.goto('/');
      const bar = page.getByRole('navigation', { name: 'Navigation principale' });

      await expect(page.getByRole('banner')).toBeHidden();
      await expect(bar).toBeVisible();
      await expect(bar.getByRole('link', { name: 'Accueil' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await expectNoHorizontalScroll(page);

      // The bar stays within the screen, at the bottom.
      const box = await bar.boundingBox();
      expect(box && box.y + box.height).toBeLessThanOrEqual(screen.height);

      await bar.getByRole('link', { name: 'Mon prono' }).click();
      await expect(page).toHaveURL(/\/predict$/);
      await expect(bar.getByRole('link', { name: 'Mon prono' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await expect(bar.getByRole('link', { name: 'Accueil' })).not.toHaveAttribute(
        'aria-current',
        'page',
      );
      await expectNoHorizontalScroll(page);

      await bar.getByRole('link', { name: 'Paramètres' }).click();
      await expect(page).toHaveURL(/\/settings$/);
      await expect(page.getByRole('button', { name: 'Déconnexion' })).toBeVisible();
      await expectNoHorizontalScroll(page);

      // The logo, alone in the top right, leads back home without covering the page's title.
      const logo = page.getByRole('link', { name: 'Mon p’tit président, retour à l’accueil' });
      const logoBox = await logo.boundingBox();
      expect(logoBox && logoBox.x + logoBox.width).toBeLessThanOrEqual(screen.width);
      expect(logoBox?.x).toBeGreaterThan(screen.width / 2);
      const title = await page.getByRole('heading', { level: 1 }).boundingBox();
      expect(logoBox && title && logoBox.y + logoBox.height).toBeLessThanOrEqual(title?.y ?? 0);
      await logo.click();
      await expect(page).toHaveURL(/\/$/);

      await page.context().close();
    });
  }

  await test.step(DESKTOP.name, async () => {
    const page = await open(browser, DESKTOP, session);
    await page.goto('/settings');
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeHidden();
    // Signing out lives in the header only.
    await expect(page.getByRole('button', { name: 'Déconnexion' })).toHaveCount(1);
    await expect(
      page.getByRole('banner').getByRole('button', { name: 'Déconnexion' }),
    ).toBeVisible();
    await page.context().close();
  });

  // Last: signing out ends the shared session.
  await test.step('sign out from the settings on a phone', async () => {
    const page = await open(browser, PHONE, session);
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Déconnexion' }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.context().close();
  });
});

test("the bottom bar's middle tab leads to the current step: the winner once the qualifiers are validated", async ({
  browser,
}) => {
  const session = await signUp(browser);
  const page = await open(browser, PHONE, session);

  // Validating the qualifiers takes too long to swipe here: the phases say they are, and the
  // winner's draft and ballot are empty.
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
              ? { ...p, playable: true, state: 'TODO' }
              : p,
        ),
      },
    });
  });
  await page.route('**/api/elections/current/winner/{draft,ballot}', (route) =>
    route.fulfill({
      json: route.request().url().endsWith('/ballot')
        ? { ballot: null, points: null }
        : { favoriteId: null },
    }),
  );

  await page.goto('/');
  const bar = page.getByRole('navigation', { name: 'Navigation principale' });
  const tab = bar.getByRole('link', { name: 'Mon prono' });
  await expect(tab).toHaveAttribute('href', '/winner');
  await expect(tab).not.toHaveAttribute('aria-current', 'page');

  await tab.click();
  await expect(page).toHaveURL(/\/winner$/);
  await expect(page.getByRole('heading', { name: 'Pronostic du vainqueur' })).toBeVisible();
  await expect(tab).toHaveAttribute('aria-current', 'page');
  await expectNoHorizontalScroll(page);
  await page.context().close();
});

const PORTRAIT_PHONES = PHONES.filter((screen) => screen.height > screen.width);

test('the swipe deck stays in place: fixed card, fixed buttons, no sideways scroll', async ({
  browser,
}) => {
  // One pass per screen size.
  test.slow();
  const session = await signUp(browser);

  for (const screen of [...PORTRAIT_PHONES, DESKTOP]) {
    await test.step(screen.name, async () => {
      const page = await open(browser, screen, session);
      await page.goto('/predict');
      const no = page.getByRole('button', { name: 'Recalé' });
      const yes = page.getByRole('button', { name: 'Qualifié' });
      const current = page.locator('[data-slot="swipe-card-item"]:not([aria-hidden])');
      const behind = page.locator('[data-slot="swipe-card-item"][aria-hidden="true"]');
      const progress = page.getByText(/^\d+ \/ \d+$/);

      // Without scrolling.
      for (const button of [no, yes]) await expect(button).toBeInViewport({ ratio: 1 });
      await expect(behind).toHaveCount(1);
      await expectNoHorizontalScroll(page);

      const boxes = async () => ({
        no: await no.boundingBox(),
        yes: await yes.boundingBox(),
        card: await current.boundingBox(),
      });
      const before = await boxes();

      for (const button of [yes, no, yes]) {
        const decided = Number((await progress.textContent())?.split(' / ')[0]);
        await button.click();
        // Mid-flight, the card thrown out is clipped.
        await expectNoHorizontalScroll(page);
        await expect(progress).toHaveText(new RegExp(`^${decided + 1} /`));
        await expect(page.locator('[data-slot="swipe-card-item"]')).toHaveCount(2);
        // Once the next card has grown to the front.
        await expect.poll(boxes).toEqual(before);
      }
      await page.context().close();
    });
  }

  await test.step('last card, then done', async () => {
    const page = await open(browser, PHONE, session);
    await page.goto('/predict');
    const progress = page.getByText(/^\d+ \/ \d+$/);
    const [decided, total] = ((await progress.textContent()) ?? '').split(' / ').map(Number);
    const card = page.locator('[data-slot="swipe-card-item"]:not([aria-hidden])');
    const size = await card.boundingBox();

    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (let n = (decided ?? 0) + 1; n < (total ?? 0); n++) {
      await page.keyboard.press('ArrowLeft');
      await expect(progress).toHaveText(`${n} / ${total}`);
    }
    // Nothing left to stack under the last card.
    await expect(page.locator('[data-slot="swipe-card-item"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="swipe-card-item"][aria-hidden]')).toHaveCount(0);

    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('link', { name: 'Passer à la revue' })).toBeVisible();
    const done = page.locator('[data-slot="swipe-card-stack"] > [data-slot="card"]');
    expect(await done.boundingBox()).toEqual(size);
    await expectNoHorizontalScroll(page);
    await page.context().close();
  });
});
