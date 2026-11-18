import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Logo } from '@/components/logo';
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
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-4">
      <h1>
        <Logo className="flex-col gap-1 text-lg" iconClassName="size-16" />
      </h1>
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
      <LanguageSwitcher />
    </div>
  );
}
