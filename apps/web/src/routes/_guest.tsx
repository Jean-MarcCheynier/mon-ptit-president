import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/language-switcher';
import { meQuery } from '@/lib/auth';

/** Pages for signed-out users; signed-in users are sent to the app. */
export const Route = createFileRoute('/_guest')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.query({
      ...meQuery,
      staleTime: 'static',
    });
    if (user) throw redirect({ to: '/' });
  },
  component: GuestLayout,
});

function GuestLayout() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-4">
      <h1 className="text-lg font-semibold">{t('app.name')}</h1>
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
      <LanguageSwitcher />
    </div>
  );
}
