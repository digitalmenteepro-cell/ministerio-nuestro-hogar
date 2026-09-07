import OneSignal from 'react-onesignal';

const ONESIGNAL_APP_ID = 'e74c71ae-1d2d-46f8-9c89-e510ae4d8aef';

let initialization: Promise<void> | undefined;

export function initializeOneSignal(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  initialization ??= OneSignal.init({
    appId: ONESIGNAL_APP_ID,
    serviceWorkerPath: 'push/onesignal/OneSignalSDKWorker.js',
    serviceWorkerParam: {
      scope: '/push/onesignal/',
    },
    autoRegister: false,
    autoResubscribe: true,
    notifyButton: {
      enable: false,
      prenotify: false,
      showCredit: false,
      text: {
        'dialog.blocked.message': '',
        'dialog.blocked.title': '',
        'dialog.main.button.subscribe': '',
        'dialog.main.button.unsubscribe': '',
        'dialog.main.title': '',
        'message.action.resubscribed': '',
        'message.action.subscribed': '',
        'message.action.subscribing': '',
        'message.action.unsubscribed': '',
        'message.prenotify': '',
        'tip.state.blocked': '',
        'tip.state.subscribed': '',
        'tip.state.unsubscribed': '',
      },
    },
  });

  return initialization;
}

export { OneSignal };
