import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, FileText, Megaphone, Music2, Search, User } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebounce } from '@/hooks/useDebounce';
import { globalSearch, type SearchResult } from '@/services/search.service';
import { errorMessage } from '@/lib/utils';

const ICONS = {
  song: Music2,
  event: CalendarDays,
  member: User,
  file: FileText,
  announcement: Megaphone,
} as const;

const KIND_LABEL = {
  song: 'Canción',
  event: 'Evento',
  member: 'Integrante',
  file: 'Archivo',
  announcement: 'Anuncio',
} as const;

export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounced = useDebounce(term);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) {
      setTerm('');
      setResults([]);
      setError(null);
      return;
    }
  }, [open]);

  useEffect(() => {
    let alive = true;
    if (debounced.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    globalSearch(debounced)
      .then((r) => alive && setResults(r))
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [debounced]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-24 max-w-xl translate-y-0">
        <DialogHeader>
          <DialogTitle>Buscador global</DialogTitle>
          <DialogDescription>Busca canciones, eventos, integrantes, archivos y anuncios.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            autoFocus
            className="pl-9"
            placeholder="Escribe al menos 2 caracteres…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>

        <div className="max-h-80 space-y-1 overflow-y-auto scrollbar-thin">
          {loading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          {error && <p className="p-3 text-sm text-red-400">{error}</p>}
          {!loading && !error && debounced.trim().length >= 2 && results.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">Sin resultados para “{debounced}”.</p>
          )}
          {!loading &&
            results.map((r) => {
              const Icon = ICONS[r.kind];
              return (
                <button
                  key={`${r.kind}-${r.id}`}
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(r.url);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-accent"
                >
                  <Icon className="h-4 w-4 shrink-0 text-brand-300" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.title}</span>
                    {r.subtitle && <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{KIND_LABEL[r.kind]}</span>
                </button>
              );
            })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
