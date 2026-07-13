import { useRegisterSW } from 'virtual:pwa-register/react';
import { Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Shows a banner when a new service worker version is waiting. */
export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (error) => console.error('Error al registrar el service worker:', error),
  });

  if (!offlineReady && !needRefresh) return null;

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-24 z-[90] mx-auto max-w-md rounded-xl border border-brand/40 bg-card p-4 shadow-2xl md:bottom-6 md:left-auto md:right-6 md:mx-0"
    >
      <div className="flex items-start gap-3">
        {needRefresh ? (
          <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" aria-hidden />
        ) : (
          <Download className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {needRefresh ? 'Nueva versión disponible' : 'Listo para usar sin conexión'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {needRefresh
              ? 'Actualiza para obtener las últimas mejoras.'
              : 'La aplicación ya funciona offline.'}
          </p>
          <div className="mt-3 flex gap-2">
            {needRefresh && (
              <Button size="sm" onClick={() => void updateServiceWorker(true)}>
                Actualizar
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={close}>
              {needRefresh ? 'Después' : 'Entendido'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
