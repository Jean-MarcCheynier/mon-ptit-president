import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { AppLogoLink } from './app-logo-link';

/**
 * A page's title. On phones, where there is no header, the logo leads it and takes the user back
 * home; on desktop, the header's logo is enough.
 */
export function PageTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <AppLogoLink className="hidden mobile:flex" />
      <h1 className={cn('min-w-0 text-2xl font-semibold', className)}>{children}</h1>
    </div>
  );
}
