import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, Outlet, redirect, useLocation } from '@tanstack/react-router';
import { House, LogOut, type LucideIcon, Settings, Vote } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { meQuery, useLogout } from '@/lib/auth';
import { currentPhasePage, PHASE_PAGES, type PhasePage, phasesQuery } from '@/lib/phases';
import { cn } from '@/lib/utils';

type NavPath = '/' | '/predict' | '/settings';

const NAV: { to: NavPath; label: 'nav.home' | 'nav.predict' | 'nav.settings'; icon: LucideIcon }[] =
  [
    { to: '/', label: 'nav.home', icon: House },
    { to: '/predict', label: 'nav.predict', icon: Vote },
    { to: '/settings', label: 'nav.settings', icon: Settings },
  ];

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
          <Link to="/" className="font-semibold">
            {t('app.name')}
          </Link>
          <nav className="flex flex-1 gap-3 text-sm text-muted-foreground">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === '/' }}
                className="hover:text-foreground [&.active]:text-foreground"
              >
                {t(item.label)}
              </Link>
            ))}
          </nav>
          <Avatar className="size-8">
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
            <AvatarFallback>{user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logout.mutate(false)}
            disabled={logout.isPending}
          >
            <LogOut />
            <span className="sr-only sm:not-sr-only">{t('nav.logout')}</span>
          </Button>
        </div>
      </header>
      {/* On phones: no header, the bottom bar (and its height) takes over. */}
      <main className="mx-auto max-w-4xl px-4 py-8 mobile:pt-4 mobile:pb-24">
        <Outlet />
      </main>
      <BottomBar />
    </div>
  );
}

/** Pages of a phase's prediction: the bottom bar's middle tab is active on all of them. */
const PHASE_PATHS: string[] = [...Object.values(PHASE_PAGES), '/review'];

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
