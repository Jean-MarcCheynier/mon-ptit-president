import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppLogo } from './app-logo';

function layers(container: HTMLElement) {
  const svg = container.querySelector('svg') as SVGSVGElement;
  const primary = svg.querySelector('[data-layer="primary"]') as SVGGElement;
  const secondary = svg.querySelector('[data-layer="secondary"]') as SVGGElement;
  return { svg, primary, secondary };
}

describe('AppLogo', () => {
  it('is decorative without a title', () => {
    const { container } = render(<AppLogo />);
    expect(layers(container).svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('is an image named by its title', () => {
    render(<AppLogo title="Mon p’tit président" />);
    expect(screen.getByRole('img', { name: 'Mon p’tit président' })).toBeInTheDocument();
  });

  it('dims the secondary layer by default, like Font Awesome duotone', () => {
    const { primary, secondary } = layers(render(<AppLogo />).container);
    expect(primary.style.opacity).toBe('var(--duotone-primary-opacity, 1)');
    expect(secondary.style.opacity).toBe('var(--duotone-secondary-opacity, 0.4)');
  });

  it('swaps which layer is dimmed', () => {
    const { primary, secondary } = layers(render(<AppLogo swapOpacity />).container);
    expect(primary.style.opacity).toBe('var(--duotone-primary-opacity, 0.4)');
    expect(secondary.style.opacity).toBe('var(--duotone-secondary-opacity, 1)');
  });

  it('exposes the chosen colours and opacities as CSS variables', () => {
    const { svg } = layers(
      render(<AppLogo primaryColor="#18181b" secondaryColor="#dc2626" secondaryOpacity={1} />)
        .container,
    );
    expect(svg.style.getPropertyValue('--duotone-primary-color')).toBe('#18181b');
    expect(svg.style.getPropertyValue('--duotone-secondary-color')).toBe('#dc2626');
    expect(svg.style.getPropertyValue('--duotone-secondary-opacity')).toBe('1');
  });

  it('keeps mask ids unique between instances', () => {
    const { container } = render(
      <>
        <AppLogo />
        <AppLogo />
      </>,
    );
    const ids = [...container.querySelectorAll('mask')].map((mask) => mask.id);
    expect(new Set(ids).size).toBe(2);
  });
});
