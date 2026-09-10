import { useEffect, useState } from 'react';
import { initializeOneSignal, OneSignal } from '@/lib/onesignal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const NOTIFICATION_TIMEOUT_MS = 8000;

export function NotificationSettings() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const pushSubscription = OneSignal.User.PushSubscription;
    const refreshNotificationState = () => {
      if (cancelled) return;
      setNotificationsEnabled(
        OneSignal.Notifications.permission === true && pushSubscription.optedIn === true,
      );
    };

    void initializeOneSignal()
      .then(() => {
        if (cancelled) return;
        pushSubscription.addEventListener('change', refreshNotificationState);
        refreshNotificationState();
      })
      .catch(() => {
        if (!cancelled) setNotificationsError('No se pudieron cargar las notificaciones.');
      });

    return () => {
      cancelled = true;
      pushSubscription.removeEventListener('change', refreshNotificationState);
    };
  }, []);

  const updateSubscription = async (enabled: boolean) => {
    setNotificationsLoading(true);
    setNotificationsError(null);

    try {
      await Promise.race([
        initializeOneSignal().then(async () => {
          if (enabled) {
            if (OneSignal.Notifications.permission === false) {
              await OneSignal.Notifications.requestPermission();
            }
            if (
              OneSignal.Notifications.permission === true &&
              OneSignal.User.PushSubscription.optedIn === false
            ) {
              await OneSignal.User.PushSubscription.optIn();
            }
          } else if (OneSignal.User.PushSubscription.optedIn === true) {
            await OneSignal.User.PushSubscription.optOut();
          }

          setNotificationsEnabled(
            OneSignal.Notifications.permission === true &&
              OneSignal.User.PushSubscription.optedIn === true,
          );
        }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error('timeout')), NOTIFICATION_TIMEOUT_MS);
        }),
      ]);
    } catch {
      setNotificationsError(
        enabled
          ? 'No se pudieron activar las notificaciones. Inténtalo nuevamente.'
          : 'No se pudieron desactivar las notificaciones. Inténtalo nuevamente.',
      );
    } finally {
      setNotificationsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Notificaciones</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Recibe avisos de ensayos, anuncios y nuevas actividades.
        </p>
        <div className="flex flex-col items-start gap-2">
          {notificationsEnabled ? (
            <>
              <span className="text-sm font-medium text-primary">Notificaciones activadas</span>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void updateSubscription(false)}
                loading={notificationsLoading}
              >
                Desactivar notificaciones
              </Button>
            </>
          ) : (
            <Button
              type="button"
              onClick={() => void updateSubscription(true)}
              loading={notificationsLoading}
            >
              Activar notificaciones
            </Button>
          )}
          {notificationsError && <p className="text-xs text-red-400">{notificationsError}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
