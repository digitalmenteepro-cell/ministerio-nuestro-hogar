import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { missingEnvVars } from '@/lib/supabase';

/** Rendered instead of the app when Supabase env vars are absent. */
export function ConfigMissing() {
  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <Card className="w-full max-w-xl">
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <AlertTriangle className="h-6 w-6 shrink-0 text-amber-400" aria-hidden />
          <CardTitle>Falta configurar Supabase</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            La aplicación no puede iniciar porque faltan variables de entorno o aún tienen valores de ejemplo:
          </p>
          <ul className="space-y-1">
            {missingEnvVars.map((v) => (
              <li key={v} className="rounded-md bg-zinc-950 px-3 py-2 font-mono text-xs text-red-300">
                {v}
              </li>
            ))}
          </ul>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Copia <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-brand-200">.env.example</code> como{' '}
              <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-brand-200">.env</code>.
            </li>
            <li>
              Pega la <b>Project URL</b> y la <b>anon public key</b> desde Supabase → Project Settings → API.
            </li>
            <li>
              Reinicia el servidor con <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-brand-200">npm run dev</code>.
            </li>
          </ol>
          <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-3 text-amber-200">
            Nunca uses la <b>service role key</b> en el frontend. Solo la anon key.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
