import { expect, type Page } from '@playwright/test';

/** A new player lands on the game's presentation: skips it, back to the journey. */
export async function skipPresentation(page: Page) {
  await expect(page.getByRole('heading', { name: 'Présentation du jeu' })).toBeVisible();
  await page.getByRole('button', { name: 'Passer' }).click();
}
