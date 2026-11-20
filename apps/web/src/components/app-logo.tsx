import { useId } from 'react';
import { DuotoneIcon, type DuotoneIconProps } from './duotone-icon';

const HAT = 'M11 20.5C17 18 20 6 32 6C44 6 47 18 53 20.5C44 17.5 20 17.5 11 20.5Z';
const HAT_TRANSFORM = 'translate(32 15) rotate(-8) scale(.88) translate(-32 -16)';
const BACKREST = 'M18 43V27Q18 17 32 17Q46 17 46 27V43';

function ChairShapes() {
  return (
    <>
      <rect x="9.75" y="33" width="7" height="10" rx="3.5" />
      <rect x="47.25" y="33" width="7" height="10" rx="3.5" />
      <rect x="12" y="43" width="40" height="6.5" rx="2.5" />
    </>
  );
}

/**
 * The game's logo: the presidential armchair everyone wants, a bicorne on top and a question mark
 * for the one who will sit in it. Duotone: outlines on the primary layer, fills on the secondary.
 */
export function AppLogo(props: DuotoneIconProps) {
  // The hat knocks the chair out behind it, so the layers stay clean at any opacity.
  const id = `app-logo-${useId().replace(/[^\w-]/g, '')}`;
  const hatId = `${id}-hat`;
  const maskId = `${id}-mask`;

  return (
    <DuotoneIcon
      viewBox="0 0 64 64"
      {...props}
      defs={
        <>
          <path id={hatId} d={HAT} transform={HAT_TRANSFORM} />
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
            <rect width="64" height="64" fill="#fff" />
            <use
              href={`#${hatId}`}
              fill="#000"
              stroke="#000"
              strokeWidth="5.5"
              strokeLinejoin="round"
            />
          </mask>
        </>
      }
      secondary={
        <>
          <g mask={`url(#${maskId})`}>
            <path d={`${BACKREST}Z`} />
            <ChairShapes />
          </g>
          <use href={`#${hatId}`} />
        </>
      }
      primary={
        <>
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <g mask={`url(#${maskId})`}>
              <path d={BACKREST} />
              <ChairShapes />
              <path d="M17.5 49.5q-.5 4 -3 7M46.5 49.5q.5 4 3 7" />
            </g>
            <path d="M28.6 27.8a3.6 3.6 0 1 1 5.2 3.2c-1.2 .6 -1.8 1.4 -1.8 2.8" />
            <use href={`#${hatId}`} strokeWidth="2.9" />
          </g>
          <circle cx="32" cy="37.6" r="1.7" />
        </>
      }
    />
  );
}
