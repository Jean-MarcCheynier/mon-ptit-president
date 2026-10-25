import { CircleAlert, CircleCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function FormAlert({
  variant,
  children,
}: {
  variant: 'error' | 'success';
  children: React.ReactNode;
}) {
  return (
    <Alert variant={variant === 'error' ? 'destructive' : 'default'}>
      {variant === 'error' ? <CircleAlert /> : <CircleCheck />}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
