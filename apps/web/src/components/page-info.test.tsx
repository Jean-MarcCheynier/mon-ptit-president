import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageInfo } from './page-info';

const onPhone = (phone: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: phone, media: query }));

const renderInfo = () => {
  render(
    <PageInfo title="Provisional list">
      <p>Only the qualified count.</p>
    </PageInfo>,
  );
  return screen.getByText('Provisional list').closest('details');
};

describe('PageInfo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is open on desktop', () => {
    onPhone(false);
    expect(renderInfo()).toHaveAttribute('open');
  });

  it('is closed on phones, and opens on its title', async () => {
    onPhone(true);
    const info = renderInfo();
    expect(info).not.toHaveAttribute('open');
    await userEvent.click(screen.getByText('Provisional list'));
    expect(info).toHaveAttribute('open');
  });
});
