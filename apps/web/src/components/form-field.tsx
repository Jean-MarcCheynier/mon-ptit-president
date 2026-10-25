import type { ComponentProps } from 'react';
import type { FieldError } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { translate } from '@/lib/errors';

interface FormFieldProps extends ComponentProps<typeof Input> {
  id: string;
  label: string;
  error?: FieldError;
  hint?: string;
}

/** Label + input + translated validation error (Zod messages are i18n keys). */
export function FormField({ id, label, error, hint, ...inputProps }: FormFieldProps) {
  const { t } = useTranslation();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...inputProps} />
      {error?.message ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {translate(t, error.message, t('errors.generic'))}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
