/** The `mobile` variant's media query (index.css): phones, upright or in landscape. */
export const MOBILE = '(max-width: 639px), (pointer: coarse) and (max-height: 500px)';

/** Whether the screen gets the phone layout right now. */
export const isMobile = () => window.matchMedia(MOBILE).matches;
