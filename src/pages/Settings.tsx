import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState } from '@/components/ErrorState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAsync } from '@/hooks/useAsync';
import { useToast } from '@/hooks/useToast';
import { getSettings, updateSettings } from '@/services/settings.service';
import { errorMessage } from '@/lib/utils';

const schema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
  logo_url: z.string().optional(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Usa un color hexadecimal (#590776).'),
  address: z.string().optional(),
  phones: z.string().optional(),
  schedule: z.string().optional(),
  instagram: z.string().optional(),
  facebook: z.string().optional(),
  youtube: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const ONESIGNAL_APP_ID = 'e74c71ae-1d2d-46f8-9c89-e510ae4d8aef';
const ONESIGNAL_SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';

export function Settings() {
  const toast = useToast();
  const settings = useAsync(() => getSettings(), []);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let pushSubscription: OneSignal['User']['PushSubscription'] | undefined;
    let refreshNotificationState: (() => void) | undefined;

    const initializeOneSignal = async () => {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal) => {
        await OneSignal.init({ appId: ONESIGNAL_APP_ID });
        pushSubscription = OneSignal.User.PushSubscription;
        refreshNotificationState = () => {
          if (!cancelled) {
            setNotificationsEnabled(
              OneSignal.Notifications.permission && OneSignal.User.PushSubscription.optedIn,
            );
          }
        };
        pushSubscription.addEventListener('change', refreshNotificationState);
        refreshNotificationState();
      });

      if (!document.querySelector(`script[src="${ONESIGNAL_SDK_URL}"]`)) {
        const script = document.createElement('script');
        script.src = ONESIGNAL_SDK_URL;
        script.async = true;
        document.head.appendChild(script);
      }
    };

    void initializeOneSignal();
    return () => {
      cancelled = true;
      if (pushSubscription && refreshNotificationState) {
        pushSubscription.removeEventListener('change', refreshNotificationState);
      }
    };
  }, []);

  const activateNotifications = () => {
    setNotificationsLoading(true);
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.Notifications.requestPermission();
        await OneSignal.User.PushSubscription.optIn();
        setNotificationsEnabled(
          OneSignal.Notifications.permission && OneSignal.User.PushSubscription.optedIn,
        );
      } finally {
        setNotificationsLoading(false);
      }
    });
  };

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    const s = settings.data;
    if (!s) return;
    reset({
      name: s.name,
      logo_url: s.logo_url ?? '',
      primary_color: s.primary_color || '#590776',
      address: s.address ?? '',
      phones: (s.phones ?? []).join(', '),
      schedule: s.schedule ?? '',
      instagram: s.socials?.instagram ?? '',
      facebook: s.socials?.facebook ?? '',
      youtube: s.socials?.youtube ?? '',
    });
  }, [settings.data, reset]);

  if (settings.loading) return <Skeleton className="h-96 w-full" />;
  if (settings.error) return <ErrorState message={settings.error} onRetry={settings.reload} />;

  const onSubmit = async (v: FormValues) => {
    try {
      await updateSettings({
        name: v.name.trim(),
        logo_url: v.logo_url?.trim() || null,
        primary_color: v.primary_color,
        address: v.address?.trim() || null,
        phones: v.phones?.trim() ? v.phones.split(',').map((p) => p.trim()).filter(Boolean) : [],
        schedule: v.schedule?.trim() || null,
        socials: {
          ...(v.instagram?.trim() ? { instagram: v.instagram.trim() } : {}),
          ...(v.facebook?.trim() ? { facebook: v.facebook.trim() } : {}),
          ...(v.youtube?.trim() ? { youtube: v.youtube.trim() } : {}),
        },
      });
      toast.success('Configuración guardada');
      settings.reload();
    } catch (err) {
      toast.error('No se pudo guardar', errorMessage(err));
    }
  };

  return (
    <PageHeader title="Configuración" description="Datos del ministerio, contacto y redes sociales.">
      <form onSubmit={handleSubmit(onSubmit)} className="grid max-w-3xl gap-4" noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identidad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="s_name">Nombre del ministerio</Label>
              <Input id="s_name" {...register('name')} />
              {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="s_logo">URL del logo</Label>
                <Input id="s_logo" placeholder="https://…" {...register('logo_url')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s_color">Color principal</Label>
                <Input id="s_color" type="text" placeholder="#590776" {...register('primary_color')} />
                {errors.primary_color && <p className="text-xs text-red-400">{errors.primary_color.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="s_address">Dirección</Label>
              <Input id="s_address" {...register('address')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s_phones">Teléfonos (separados por coma)</Label>
              <Input id="s_phones" placeholder="+56 9 1111 1111, +56 9 2222 2222" {...register('phones')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s_schedule">Horarios</Label>
              <Textarea id="s_schedule" rows={3} placeholder="Ensayos: miércoles 19:30…" {...register('schedule')} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Redes sociales</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="s_ig">Instagram</Label>
              <Input id="s_ig" {...register('instagram')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s_fb">Facebook</Label>
              <Input id="s_fb" {...register('facebook')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s_yt">YouTube</Label>
              <Input id="s_yt" {...register('youtube')} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notificaciones</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Recibe avisos de ensayos, anuncios, nuevas canciones y cambios importantes.
            </p>
            {notificationsEnabled ? (
              <span className="text-sm font-medium text-primary">Notificaciones activadas</span>
            ) : (
              <Button type="button" onClick={activateNotifications} loading={notificationsLoading}>
                Activar notificaciones
              </Button>
            )}
          </CardContent>
        </Card>

        <div>
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            Guardar configuración
          </Button>
        </div>
      </form>
    </PageHeader>
  );
}
