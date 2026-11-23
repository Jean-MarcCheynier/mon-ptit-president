import type { ReactNode } from 'react';
import { PageTitle } from './page-title';

interface PageHeaderProps {
  title: ReactNode;
  /** One or two sentences under the title, on what the page is for; none when it speaks for itself. */
  description?: ReactNode;
  /** For the title (e.g. a smaller one on phones). */
  titleClassName?: string;
}

/** Every page's head: its title, then an optional description. */
export function PageHeader({ title, description, titleClassName }: PageHeaderProps) {
  return (
    <div className="grid gap-2">
      <PageTitle className={titleClassName}>{title}</PageTitle>
      {description ? <p className="text-muted-foreground">{description}</p> : null}
    </div>
  );
}
