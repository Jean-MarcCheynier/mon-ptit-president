import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageTitle } from './page-title';

async function renderTitle() {
  const rootRoute = createRootRoute();
  const page = () => <PageTitle>Paramètres</PageTitle>;
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      createRoute({ getParentRoute: () => rootRoute, path: '/', component: page }),
      createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: page }),
    ]),
    history: createMemoryHistory({ initialEntries: ['/settings'] }),
  });
  render(<RouterProvider router={router} />);
  return screen.findByRole('heading', { level: 1 });
}

describe('PageTitle', () => {
  it('shows the title as the page heading', async () => {
    expect(await renderTitle()).toHaveTextContent(/^Paramètres$/);
  });

  it('leads the title with the logo, back home, shown on phones only', async () => {
    const heading = await renderTitle();
    const logo = screen.getByRole('link', { name: 'Mon p’tit président, back to home' });
    expect(logo).toHaveAttribute('href', '/');
    expect(logo.nextElementSibling).toBe(heading);
    expect(logo).toHaveClass('hidden', 'mobile:flex');
  });
});
