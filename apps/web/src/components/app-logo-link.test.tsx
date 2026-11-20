import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { AppLogoLink } from './app-logo-link';

/** Renders `ui` on a page other than home, in a router that knows the home route. */
async function renderInRouter(ui: ReactNode) {
  const rootRoute = createRootRoute();
  const page = () => <>{ui}</>;
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      createRoute({ getParentRoute: () => rootRoute, path: '/', component: page }),
      createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: page }),
    ]),
    history: createMemoryHistory({ initialEntries: ['/settings'] }),
  });
  render(<RouterProvider router={router} />);
  return screen.findByRole('link');
}

describe('AppLogoLink', () => {
  it('leads home, named after the game', async () => {
    const link = await renderInRouter(<AppLogoLink />);
    expect(link).toHaveAccessibleName('Mon p’tit président, back to home');
    expect(link).toHaveAttribute('href', '/');
  });

  it('shows the logo alone by default, as decoration of the link', async () => {
    const link = await renderInRouter(<AppLogoLink />);
    expect(link).toHaveTextContent(/^$/);
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it("shows the game's name next to the logo", async () => {
    const link = await renderInRouter(<AppLogoLink withName />);
    expect(link).toHaveTextContent('Mon p’tit président');
  });

  it('fills the armchair and the bicorne with the logo red, at full opacity', async () => {
    const svg = (await renderInRouter(<AppLogoLink />)).querySelector('svg') as SVGSVGElement;
    expect(svg.style.getPropertyValue('--duotone-secondary-color')).toBe('var(--logo-accent)');
    expect(svg.style.getPropertyValue('--duotone-secondary-opacity')).toBe('1');
  });
});
