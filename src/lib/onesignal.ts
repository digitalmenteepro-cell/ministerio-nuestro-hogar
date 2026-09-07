import OneSignal from 'react-onesignal';

const ONESIGNAL_APP_ID = 'e74c71ae-1d2d-46f8-9c89-e510ae4d8aef';

let initialization: Promise<void> | undefined;

export function initializeOneSignal(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  initialization ??= OneSignal.init({
    appId: ONESIGNAL_APP_ID,
    serviceWorkerPath: '/push/onesignal/OneSignalSDKWorker.js',
    serviceWorkerParam: { scope: '/push/onesignal/' },
    autoRegister: false,
    autoResubscribe: false,
  });

  return initialization;
}

export { OneSignal };
