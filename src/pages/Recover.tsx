import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { errorMessage } from '@/lib/utils';

const schema = z.object({ email: z.string().min(1, 'Ingresa tu correo.').email('Correo inválido.') });
type FormValues = z.infer<typeof schema>;

export function Recover() {
  const { requestPasswordReset } = useAuth();
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const onSubmit = async ({ email }: FormValues) => {
    setServerError('');
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setServerError(errorMessage(err));
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          {sent ? (
            <div className="space-y-3 text-center">
              <MailCheck className="mx-auto h-12 w-12 text-emerald-400" aria-hidden />
              <h1 className="text-xl font-bold">Revisa tu correo</h1>
              <p className="text-sm text-muted-foreground">
                Si la cuenta existe, enviamos un enlace para restablecer la contraseña. El enlace expira en 1 hora.
              </p>
              <Link to="/login">
                <Button variant="secondary" className="mt-2 w-full">
                  Volver al inicio de sesión
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Recuperar contraseña</h1>
              <p className="mb-5 mt-1 text-sm text-muted-foreground">Te enviaremos un enlace seguro por correo.</p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Correo</Label>
                  <Input id="email" type="email" autoComplete="email" placeholder="tu@correo.com" {...register('email')} />
                  {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
                </div>

                {serverError && (
                  <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-300">
                    {serverError}
                  </p>
                )}

                <Button type="submit" className="w-full" loading={isSubmitting}>
                  Enviar enlace
                </Button>

                <Link to="/login" className="flex items-center justify-center gap-1 text-sm text-brand-300 hover:underline">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Volver
                </Link>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
