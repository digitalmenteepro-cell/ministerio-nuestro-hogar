import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center p-4 text-center">
      <div>
        <p className="text-7xl font-black text-brand-400">404</p>
        <h1 className="mt-3 text-2xl font-bold">Página no encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">La ruta que buscas no existe o fue movida.</p>
        <Link to="/">
          <Button className="mt-5">Volver al inicio</Button>
        </Link>
      </div>
    </div>
  );
}
