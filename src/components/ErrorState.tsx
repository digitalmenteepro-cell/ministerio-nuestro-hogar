import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-3 p-10 text-center" role="alert">
      <AlertTriangle className="h-9 w-9 text-red-400" aria-hidden />
      <h3 className="text-lg font-semibold">No pudimos cargar la información</h3>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="mt-2">
          <RotateCw className="h-4 w-4" />
          Reintentar
        </Button>
      )}
    </Card>
  );
}
