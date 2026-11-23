import { ChevronDown, Info } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { isMobile } from '@/lib/media';
import { cn } from '@/lib/utils';

interface PageInfoProps {
  /** Always shown, open or closed. */
  title: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Something worth knowing on a page, that can be put away: open on desktop, closed on phones,
 * where room is short. Each visit starts over from that default.
 */
export function PageInfo({ title, children, className }: PageInfoProps) {
  const [open, setOpen] = useState(() => !isMobile());
  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className={cn('group rounded-lg border p-4 text-sm', className)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 font-medium">
        <Info aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1">{title}</span>
        <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 grid gap-3">{children}</div>
    </details>
  );
}
