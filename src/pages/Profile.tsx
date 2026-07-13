import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { KeyRound, Upload } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState } from '@/components/ErrorState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import { listInstruments } from '@/services/instruments.service';
import { updateProfile } from '@/services/profiles.service';
import { uploadAvatar } from '@/services/storage.service';
import { errorMessage, initials } from '@/lib/utils';

const schema = z.object({
  first_name: z.string().min(1, 'Ingresa tu nombre.'),
  last_name: z.string().min(1, 'Ingresa tu apellido.'),
  phone: z.string().optional(),
  instrument_id: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const NONE = '__none__';

/** A musician may edit only their own profile — never role or active status. */
export function Profile() {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const instruments = useAsync(() => listInstruments(), []);
  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (profile) {
      reset({
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone: profile.phone ?? '',
        instrument_id: profile.instrument_id ?? NONE,
      });
    }
  }, [profile, reset]);

  if (!profile) return <Skeleton className="h-96 w-full" />;

  const onSubmit = async (values: FormValues) => {
    try {
      await updateProfile(profile.id, {
        first_name: values.first_name,
        last_name: values.last_name,
        phone: values.phone?.trim() || null,
        instrument_id: values.instrument_id === NONE ? null : (values.instrument_id ?? null),
      });
      await refreshProfile();
      toast.success('Perfil actualizado');
    } catch (err) {
      toast.error('No se pudo guardar', errorMessage(err));
    }
  };

  const onAvatar = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadAvatar(file, profile.id);
      await updateProfile(profile.id, { avatar_url: url });
      await refreshProfile();
      toast.success('Foto actualizada');
    } catch (err) {
      toast.error('No se pudo subir la foto', errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <PageHeader title="Mi perfil" description="Actualiza tus datos personales.">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Datos personales</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="first_name">Nombre</Label>
                  <Input id="first_name" {...register('first_name')} />
                  {errors.first_name && <p className="text-xs text-red-400">{errors.first_name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last_name">Apellido</Label>
                  <Input id="last_name" {...register('last_name')} />
                  {errors.last_name && <p className="text-xs text-red-400">{errors.last_name.message}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Correo</Label>
                <Input id="email" value={profile.email} disabled readOnly />
                <p className="text-xs text-muted-foreground">El correo no se puede modificar.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input id="phone" type="tel" placeholder="+56 9 1234 5678" {...register('phone')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Instrumento</Label>
                  <Select
                    value={watch('instrument_id') ?? NONE}
                    onValueChange={(v) => setValue('instrument_id', v, { shouldDirty: true })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sin instrumento</SelectItem>
                      {(instruments.data ?? [])
                        .filter((i) => i.active)
                        .map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {instruments.error && <ErrorState message={instruments.error} onRetry={instruments.reload} />}

              <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
                Guardar cambios
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Foto de perfil</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-brand/25 text-2xl font-bold text-brand-200">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials(profile)
                )}
              </div>
              <Label htmlFor="avatar" className="w-full">
                <div className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-secondary text-sm font-medium hover:bg-zinc-700">
                  <Upload className="h-4 w-4" />
                  {uploading ? 'Subiendo…' : 'Cambiar foto'}
                </div>
                <input
                  id="avatar"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onAvatar(file);
                    e.target.value = '';
                  }}
                />
              </Label>
              <p className="text-center text-xs text-muted-foreground">JPG, PNG o WEBP. Máximo 5 MB.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Seguridad</CardTitle>
            </CardHeader>
            <CardContent>
              <Link to="/cambiar-contrasena">
                <Button variant="secondary" className="w-full justify-start gap-2">
                  <KeyRound className="h-4 w-4" />
                  Cambiar contraseña
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageHeader>
  );
}
