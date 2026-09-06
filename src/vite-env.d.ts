/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

type OneSignalDeferredCallback = (oneSignal: OneSignal) => void | Promise<void>;

interface OneSignal {
  init(options: { appId: string }): Promise<void>;
  Notifications: {
    permission: boolean;
    requestPermission(): Promise<void>;
  };
}

interface Window {
  OneSignalDeferred?: OneSignalDeferredCallback[];
}

