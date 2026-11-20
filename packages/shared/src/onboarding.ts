/**
 * Version of the game's presentation (the PRESENTATION phase). Bump it on each major change of
 * the rules: the presentation is then proposed again to every player, without blocking anything.
 */
export const ONBOARDING_VERSION = 1;

/** Whether the player should be offered the presentation: never seen, or seen in an older version. */
export const isOnboardingOutdated = (versionSeen: number) => versionSeen < ONBOARDING_VERSION;
