import type { GamePhase, PlayerPhaseDto } from '@presidency-bingo/shared';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, Outlet, redirect, useLocation } from '@tanstack/react-router';
import { House, LogOut, type LucideIcon, Settings, Vote } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLogoLink } from '@/components/app-logo-link';
import { PHASE_COLORS } from '@/components/phase-trail';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { meQuery, useLogout } from '@/lib/auth';
import {
  currentPhasePage,
  isReachable,
  PHASE_PAGES,
  type PhasePage,
  phasesQuery,
  usePhaseState,
} from '@/lib/phases';
import { cn } from '@/lib/utils';

/** Signed-in area: anonymous visitors are sent to /login and brought back afterwards. */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.query({
      ...meQuery,
      staleTime: 'static',
    });
    if (!user) throw redirect({ to: '/login', search: { redirect: location.href } });
  },
  component: AppLayout,
});

function AppLayout() {
  const { t, i18n } = useTranslation();
  const { data: user } = useSuspenseQuery(meQuery);
  const logout = useLogout();
  // The presentation takes the whole phone screen: no bottom bar.
  const immersive = useLocation({ select: (location) => location.pathname === '/presentation' });

  // The account's language wins over the browser's.
  useEffect(() => {
    if (user?.locale && user.locale !== i18n.resolvedLanguage)
      void i18n.changeLanguage(user.locale);
  }, [user?.locale, i18n]);

  if (!user) return null;

  return (
    // Clipped: a swiped card flies off the screen without making the page scroll sideways.
    <div className="min-h-svh overflow-x-clip">
      <header className="border-b mobile:hidden">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4">
          <HeaderNav />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logout.mutate(false)}
            disabled={logout.isPending}
          >
            <LogOut />
            {/* Below lg, its room goes to the phases. */}
            <span className="sr-only lg:not-sr-only">{t('nav.logout')}</span>
          </Button>
          {/* Top right, where the eye ends its sweep. Below md, the name's room goes to the phases. */}
          <AppLogoLink withName className="[&>span]:max-md:hidden" />
        </div>
      </header>
      {/* On phones: no header, the bottom bar (and its height) takes over. */}
      <main
        className={cn(
          'mx-auto max-w-4xl px-4 py-8 mobile:pt-4',
          immersive
            ? 'mobile:flex mobile:min-h-svh mobile:flex-col mobile:pb-[max(1rem,env(safe-area-inset-bottom))]'
            : 'mobile:pb-24',
        )}
      >
        <Outlet />
      </main>
      {immersive ? null : <BottomBar />}
    </div>
  );
}

/** Pages of a phase's prediction: the bottom bar's middle tab is active on all of them. */
const PHASE_PATHS: string[] = [...Object.values(PHASE_PAGES), '/review'];

/** The phases with a page, in the journey's order. */
const PAGED_PHASES = Object.keys(PHASE_PAGES) as (keyof typeof PHASE_PAGES)[];

const NAV_LINK =
  'whitespace-nowrap hover:text-foreground [&.active]:font-medium [&.active]:text-foreground';

/**
 * Desktop navigation: home, each phase that has a page (with its state's color), then the
 * settings. The phases keep their place before they open, greyed out.
 */
function HeaderNav() {
  const { t } = useTranslation();
  // Not suspended: while loading, on failure or without an election, the phases are plain links.
  const { data: phases } = useQuery(phasesQuery);
  return (
    <TooltipProvider>
      <nav className="flex min-w-0 flex-1 items-center gap-3 text-sm text-muted-foreground md:gap-4">
        <Link to="/" activeOptions={{ exact: true }} className={NAV_LINK}>
          {t('nav.home')}
        </Link>
        {PAGED_PHASES.map((phase) => (
          <PhaseNavLink key={phase} phase={phase} player={phases?.find((p) => p.phase === phase)} />
        ))}
        <Link to="/settings" className={NAV_LINK}>
          {t('nav.settings')}
        </Link>
      </nav>
    </TooltipProvider>
  );
}

function PhaseNavLink({
  phase,
  player,
}: {
  phase: keyof typeof PHASE_PAGES;
  /** Where the player stands in it; unknown while loading or without an election. */
  player: PlayerPhaseDto | undefined;
}) {
  const { t } = useTranslation();
  const pathname = useLocation({ select: (location) => location.pathname });
  const state = usePhaseState(player);
  const name = t(`phases.names.${phase satisfies GamePhase}`);
  const dot = player ? (
    <span aria-hidden className={cn('size-2 shrink-0 rounded-full', PHASE_COLORS[state].bg)} />
  ) : null;
  const content = (
    <>
      {dot}
      {name}
    </>
  );
  const className = cn(NAV_LINK, 'flex items-center gap-1.5');

  if (player && !isReachable(state)) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Not `disabled`: it stays focusable, for its tooltip to show from the keyboard too. */}
          <button
            type="button"
            aria-disabled="true"
            className={cn(className, 'cursor-not-allowed opacity-50 hover:text-muted-foreground')}
          >
            {content}
          </button>
        </TooltipTrigger>
        <TooltipContent>{t('phases.states.UPCOMING')}</TooltipContent>
      </Tooltip>
    );
  }
  // The qualifiers' review of a draft belongs to its phase.
  const active = phase === 'QUALIFIERS' && pathname === '/review';
  return (
    <Link
      to={PHASE_PAGES[phase]}
      aria-current={active ? 'page' : undefined}
      className={cn(className, active && 'active')}
    >
      {content}
    </Link>
  );
}

/** Phone navigation, within thumb's reach; replaces the header. */
function BottomBar() {
  const { t } = useTranslation();
  const pathname = useLocation({ select: (location) => location.pathname });
  // Not suspended: while loading, on failure or without an election, the tab leads to the qualifiers.
  const { data: phases } = useQuery(phasesQuery);
  const phasePage = phases ? currentPhasePage(phases) : PHASE_PAGES.QUALIFIERS;

  const items: {
    to: '/' | PhasePage | '/settings';
    label: 'nav.home' | 'nav.myPrediction' | 'nav.settings';
    icon: LucideIcon;
    active?: boolean;
  }[] = [
    { to: '/', label: 'nav.home', icon: House },
    // Fixed label: the tab keeps its width and place whatever the step.
    {
      to: phasePage,
      label: 'nav.myPrediction',
      icon: Vote,
      active: PHASE_PATHS.includes(pathname),
    },
    { to: '/settings', label: 'nav.settings', icon: Settings },
  ];

  return (
    <nav
      aria-label={t('nav.label')}
      className="fixed inset-x-0 bottom-0 z-40 hidden border-t bg-background/95 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] backdrop-blur mobile:block"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-3">
        {items.map(({ to, label, icon: Icon, active }) => (
          <li key={label} className="grid">
            <Link
              to={to}
              activeOptions={{ exact: to === '/' }}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground [&.active]:font-medium [&.active]:text-foreground [&.active_svg]:stroke-[2.5]',
                active && 'active',
              )}
            >
              <Icon aria-hidden className="size-5" />
              {t(label)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
