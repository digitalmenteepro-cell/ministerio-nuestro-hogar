import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ONESIGNAL_APP_ID = 'e74c71ae-1d2d-46f8-9c89-e510ae4d8aef';

export function OneSignalNotifications() {
  const [oneSignal, setOneSignal] = useState<OneSignalSdk | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    if (!('Notification' in window) || !window.OneSignalDeferred) return;

    window.OneSignalDeferred.push(async (instance) => {
      await instance.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        serviceWorkerPath: '/OneSignalSDKWorker.js',
        serviceWorkerParam: { scope: '/' },
      });
      setOneSignal(instance);
      setPermission(Notification.permission);
    });
  }, []);

  const requestPermission = async () => {
    if (!oneSignal || isRequesting) return;

    setIsRequesting(true);
    try {
      await oneSignal.Notifications.requestPermission();
      setPermission(Notification.permission);
    } finally {
      setIsRequesting(false);
    }
  };

  if (permission === 'granted') return null;

  return (
    <Button
      type="button"
      variant="secondary"
      className="mb-4 w-full justify-start gap-2"
      onClick={requestPermission}
      disabled={!oneSignal || permission === 'denied' || isRequesting}
      aria-label="Activar notificaciones"
    >
      <Bell className="h-4 w-4" aria-hidden />
      {permission === 'denied' ? 'Notificaciones bloqueadas' : 'Activar notificaciones'}
    </Button>
  );
}

type OneSignalSdk = {
  init: (options: {
    appId: string;
    allowLocalhostAsSecureOrigin: boolean;
    serviceWorkerPath: string;
    serviceWorkerParam: { scope: string };
  }) => Promise<void>;
  Notifications: {
    requestPermission: () => Promise<void>;
  };
};

declare global {
  interface Window {
    OneSignalDeferred?: Array<(instance: OneSignalSdk) => void | Promise<void>>;
  }
}
