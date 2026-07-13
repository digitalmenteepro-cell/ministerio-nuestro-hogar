import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { errorMessage } from '@/lib/utils';

const schema = z.object({
  email: z.string().min(1, 'Ingresa tu correo.').email('Correo inválido.'),
  password: z.string().min(6, 'Mínimo 6 caracteres.'),
});

type FormValues = z.infer<typeof schema>;

export function Login() {
  const { session, signIn } = useAuth();
  const location = useLocation();
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  if (session) {
    const from = (location.state as { from?: Location } | null)?.from?.pathname ?? '/';
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (values: FormValues) => {
    setServerError('');
    try {
      await signIn(values.email, values.password);
    } catch (err) {
      setServerError(errorMessage(err));
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-brand text-xl font-black text-white">
              NH
            </div>
            <h1 className="text-2xl font-bold">Bienvenido</h1>
            <p className="text-sm text-muted-foreground">Ministerio de Alabanza Nuestro Hogar</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="tu@correo.com"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pr-10"
                  aria-invalid={!!errors.password}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
            </div>

            {serverError && (
              <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-300">
                {serverError}
              </p>
            )}

            <Button type="submit" className="w-full" loading={isSubmitting}>
              Ingresar
            </Button>

            <Link to="/recuperar" className="block text-center text-sm text-brand-300 hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
