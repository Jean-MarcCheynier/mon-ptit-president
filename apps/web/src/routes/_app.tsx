import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router';
import { LogOut } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { meQuery, useLogout } from '@/lib/auth';

/** Signed-in area: anonymous visitors are sent to /login and brought back afterwards. */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(meQuery);
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
    <div className="min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4">
          <Link to="/" className="font-semibold">
            {t('app.name')}
          </Link>
          <nav className="flex flex-1 gap-3 text-sm text-muted-foreground">
            <Link
              to="/"
              activeOptions={{ exact: true }}
              className="hover:text-foreground [&.active]:text-foreground"
            >
              {t('nav.home')}
            </Link>
            <Link to="/settings" className="hover:text-foreground [&.active]:text-foreground">
              {t('nav.settings')}
            </Link>
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
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
