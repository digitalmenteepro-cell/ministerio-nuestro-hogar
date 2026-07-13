import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import { errorMessage } from '@/lib/utils';

const schema = z
  .object({
    password: z.string().min(8, 'Mínimo 8 caracteres.'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirm'],
  });

type FormValues = z.infer<typeof schema>;

/**
 * Used both for the reset-link flow (Supabase puts a recovery session in the
 * URL) and for a logged-in user changing their own password.
 */
export function ChangePassword() {
  const { changePassword, session } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } });

  const onSubmit = async ({ password }: FormValues) => {
    setServerError('');
    try {
      await changePassword(password);
      toast.success('Contraseña actualizada', 'Ya puedes usar tu nueva contraseña.');
      navigate(session ? '/perfil' : '/login', { replace: true });
    } catch (err) {
      setServerError(errorMessage(err));
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <h1 className="text-2xl font-bold">Cambiar contraseña</h1>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">Elige una contraseña nueva y segura.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="password">Nueva contraseña</Label>
              <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
              {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirmar contraseña</Label>
              <Input id="confirm" type="password" autoComplete="new-password" {...register('confirm')} />
              {errors.confirm && <p className="text-xs text-red-400">{errors.confirm.message}</p>}
            </div>

            {serverError && (
              <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-300">
                {serverError}
              </p>
            )}

            <Button type="submit" className="w-full" loading={isSubmitting}>
              Guardar contraseña
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
