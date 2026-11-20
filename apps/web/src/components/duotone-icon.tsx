import type { CSSProperties, ReactNode, SVGProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * Colours and opacities of a duotone icon's two layers, in the spirit of Font Awesome Duotone:
 * the primary layer draws the outlines, the secondary layer the fills behind them.
 * Each one can also be set from CSS through `--duotone-primary-color`, `--duotone-secondary-color`,
 * `--duotone-primary-opacity` and `--duotone-secondary-opacity` (e.g. a Tailwind
 * `[--duotone-secondary-color:var(--destructive)]` class); both colours default to `currentColor`.
 */
export interface DuotoneStyleProps {
  primaryColor?: string;
  secondaryColor?: string;
  primaryOpacity?: number;
  /** Defaults to 0.4, as in Font Awesome. */
  secondaryOpacity?: number;
  /** Puts the reduced opacity on the primary layer instead of the secondary one. */
  swapOpacity?: boolean;
}

export interface DuotoneIconProps
  extends DuotoneStyleProps,
    Omit<SVGProps<SVGSVGElement>, 'children' | 'title' | 'viewBox'> {
  /** Accessible name; without it the icon is decorative and hidden from assistive tech. */
  title?: string;
}

interface DuotoneIconBaseProps extends DuotoneIconProps {
  viewBox: string;
  defs?: ReactNode;
  primary: ReactNode;
  secondary: ReactNode;
}

const DEFAULT_REDUCED_OPACITY = 0.4;

/** Renders the two layers of a duotone icon; concrete icons only provide their shapes. */
export function DuotoneIcon({
  viewBox,
  defs,
  primary,
  secondary,
  primaryColor,
  secondaryColor,
  primaryOpacity,
  secondaryOpacity,
  swapOpacity = false,
  title,
  className,
  style,
  ...svgProps
}: DuotoneIconBaseProps) {
  const variables = {
    '--duotone-primary-color': primaryColor,
    '--duotone-secondary-color': secondaryColor,
    '--duotone-primary-opacity': primaryOpacity,
    '--duotone-secondary-opacity': secondaryOpacity,
  } as CSSProperties;
  const reduced = DEFAULT_REDUCED_OPACITY;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      className={cn('size-6 shrink-0', className)}
      style={{ ...variables, ...style }}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      {...svgProps}
    >
      {title ? <title>{title}</title> : null}
      {defs ? <defs>{defs}</defs> : null}
      <g
        data-layer="secondary"
        fill="currentColor"
        style={{
          color: 'var(--duotone-secondary-color, currentColor)',
          opacity: `var(--duotone-secondary-opacity, ${swapOpacity ? 1 : reduced})`,
        }}
      >
        {secondary}
      </g>
      <g
        data-layer="primary"
        fill="currentColor"
        style={{
          color: 'var(--duotone-primary-color, currentColor)',
          opacity: `var(--duotone-primary-opacity, ${swapOpacity ? reduced : 1})`,
        }}
      >
        {primary}
      </g>
    </svg>
  );
}
