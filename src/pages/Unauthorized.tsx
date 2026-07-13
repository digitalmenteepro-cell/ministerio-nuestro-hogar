import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export function Unauthorized() {
  const { profile, signOut } = useAuth();
  const inactive = profile && !profile.active;

  return (
    <div className="grid min-h-dvh place-items-center p-4 text-center">
      <div className="max-w-md space-y-4">
        <ShieldAlert className="mx-auto h-16 w-16 text-amber-400" aria-hidden />
        <h1 className="text-2xl font-bold">
          {inactive ? 'Tu cuenta está desactivada' : 'Acceso no autorizado'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {inactive
            ? 'Un administrador desactivó tu cuenta. Contáctalo para reactivarla.'
            : 'No tienes permisos para acceder a esta sección. Si crees que es un error, contacta a un administrador.'}
        </p>
        <div className="flex justify-center gap-3">
          <Link to="/">
            <Button variant="secondary">Volver al inicio</Button>
          </Link>
          <Button variant="ghost" onClick={() => void signOut()}>
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  );
}
