import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export function initials(name: string): string {
  const words = name.split(/[\s-]+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words.at(-1)] : words;
  return letters.map((word) => word?.charAt(0).toLocaleUpperCase() ?? '').join('');
}

interface PoliticianAvatarProps {
  name: string;
  photoUrl: string | null;
  className?: string;
}

/** Photo when available; initials when there is none or it fails to load. */
export function PoliticianAvatar({ name, photoUrl, className }: PoliticianAvatarProps) {
  return (
    <Avatar className={cn('size-10', className)} title={name}>
      {photoUrl ? <AvatarImage src={photoUrl} alt={name} className="object-cover" /> : null}
      <AvatarFallback className="text-xs font-medium">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
