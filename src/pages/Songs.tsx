import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ExternalLink, Music2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SkeletonTable } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import { createSong, deleteSong, listSongs, updateSong, type SongInput } from '@/services/songs.service';
import { errorMessage, formatDuration, parseDuration } from '@/lib/utils';
import { sendPushNotification } from '@/lib/notifications';
import type { Song } from '@/types';

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || /^https?:\/\/.+/.test(v), 'Debe ser una URL válida (https://…).');

const schema = z.object({
  title: z.string().min(1, 'El título es obligatorio.'),
  author: z.string().optional(),
  song_key: z.string().optional(),
  bpm: z.string().optional().refine(
    (v) => !v || (Number(v) >= 1 && Number(v) <= 400),
    'BPM debe estar entre 1 y 400.',
  ),
  duration: z.string().optional().refine(
    (v) => !v || /^\d{1,2}:\d{2}$/.test(v),
    'Usa el formato mm:ss (ej: 4:35).',
  ),
  capo: z.string().optional(),
  version: z.string().optional(),
  notes: z.string().optional(),
  lyrics: z.string().optional(),
  spotify_url: optionalUrl,
  youtube_url: optionalUrl,
  pdf_path: z.string().optional(),
  score_path: z.string().optional(),
  audio_path: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  title: '', author: '', song_key: '', bpm: '', duration: '', capo: '', version: '',
  notes: '', lyrics: '', spotify_url: '', youtube_url: '', pdf_path: '', score_path: '', audio_path: '',
};

function toForm(s: Song): FormValues {
  return {
    title: s.title,
    author: s.author ?? '',
    song_key: s.song_key ?? '',
    bpm: s.bpm != null ? String(s.bpm) : '',
    duration: s.duration_seconds != null ? formatDuration(s.duration_seconds) : '',
    capo: s.capo ?? '',
    version: s.version ?? '',
    notes: s.notes ?? '',
    lyrics: s.lyrics ?? '',
    spotify_url: s.spotify_url ?? '',
    youtube_url: s.youtube_url ?? '',
    pdf_path: s.pdf_path ?? '',
    score_path: s.score_path ?? '',
    audio_path: s.audio_path ?? '',
  };
}

function toPayload(v: FormValues): SongInput {
  const clean = (s?: string) => (s?.trim() ? s.trim() : null);
  return {
    title: v.title.trim(),
    author: clean(v.author),
    song_key: clean(v.song_key),
    bpm: v.bpm?.trim() ? Number(v.bpm) : null,
    duration_seconds: v.duration?.trim() ? parseDuration(v.duration) : null,
    capo: clean(v.capo),
    version: clean(v.version),
    notes: clean(v.notes),
    lyrics: clean(v.lyrics),
    spotify_url: clean(v.spotify_url),
    youtube_url: clean(v.youtube_url),
    pdf_path: clean(v.pdf_path),
    score_path: clean(v.score_path),
    audio_path: clean(v.audio_path),
  };
}

export function Songs() {
  const { profile, isAdmin } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search);
  const songs = useAsync(() => listSongs(debounced), [debounced]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Song | null>(null);
  const [toDelete, setToDelete] = useState<Song | null>(null);
  const [detail, setDetail] = useState<Song | null>(null);

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  const openCreate = () => {
    setEditing(null);
    reset(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (s: Song) => {
    setEditing(s);
    reset(toForm(s));
    setDialogOpen(true);
  };

  const onSubmit = async (values: FormValues) => {
    if (!profile) return;
    try {
      if (editing) {
        await updateSong(editing.id, toPayload(values));
        toast.success('Canción actualizada');
      } else {
        const payload = toPayload(values);
        await createSong(payload, profile.id);
        toast.success('Canción agregada');
        try {
          await sendPushNotification({
            title: 'Nueva canción',
            message: `Se agregó «${payload.title}» al repertorio.`,
            url: 'https://ministerio-nuestro-hogar.vercel.app/repertorio',
          });
        } catch {
          toast.error('Canción guardada', 'No se pudo enviar la notificación push.');
        }
      }
      setDialogOpen(false);
      songs.reload();
    } catch (err) {
      toast.error('No se pudo guardar', errorMessage(err));
    }
  };

  return (
    <PageHeader
      title="Repertorio"
      description="Canciones, tonalidades, partituras y recursos."
      action={
        isAdmin ? (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nueva canción
          </Button>
        ) : undefined
      }
    >
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
        <Input
          className="pl-9"
          placeholder="Buscar por título o autor…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {songs.loading && <SkeletonTable rows={5} />}
      {songs.error && <ErrorState message={songs.error} onRetry={songs.reload} />}

      {songs.data?.length === 0 && (
        <EmptyState
          icon={Music2}
          title={debounced ? 'Sin resultados' : 'El repertorio está vacío'}
          description={
            debounced
              ? `Ninguna canción coincide con “${debounced}”.`
              : 'Agrega la primera canción del ministerio.'
          }
          action={
            isAdmin && !debounced ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Nueva canción
              </Button>
            ) : undefined
          }
        />
      )}

      <div className="space-y-2">
        {(songs.data ?? []).map((s) => (
          <Card key={s.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => setDetail(s)}
              >
                <p className="truncate font-medium">{s.title}</p>
                <p className="truncate text-xs text-muted-foreground">{s.author || 'Autor desconocido'}</p>
              </button>

              <div className="flex flex-wrap items-center gap-2">
                {s.song_key && <Badge>Tono {s.song_key}</Badge>}
                {s.bpm && <Badge variant="secondary">{s.bpm} BPM</Badge>}
                {s.duration_seconds != null && (
                  <Badge variant="secondary">{formatDuration(s.duration_seconds)}</Badge>
                )}
                {s.capo && <Badge variant="outline">Capo {s.capo}</Badge>}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {s.spotify_url && (
                  <a href={s.spotify_url} target="_blank" rel="noreferrer" aria-label="Abrir en Spotify">
                    <Button variant="ghost" size="icon">
                      <ExternalLink className="h-4 w-4 text-emerald-400" />
                    </Button>
                  </a>
                )}
                {s.youtube_url && (
                  <a href={s.youtube_url} target="_blank" rel="noreferrer" aria-label="Abrir en YouTube">
                    <Button variant="ghost" size="icon">
                      <ExternalLink className="h-4 w-4 text-red-400" />
                    </Button>
                  </a>
                )}
                {isAdmin && (
                  <>
                    <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => openEdit(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Eliminar" onClick={() => setToDelete(s)}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detail (lyrics + notes) */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
            <DialogDescription>{detail?.author || 'Autor desconocido'}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {detail?.song_key && <Badge>Tono {detail.song_key}</Badge>}
            {detail?.bpm && <Badge variant="secondary">{detail.bpm} BPM</Badge>}
            {detail?.duration_seconds != null && (
              <Badge variant="secondary">{formatDuration(detail.duration_seconds)}</Badge>
            )}
            {detail?.capo && <Badge variant="outline">Capo {detail.capo}</Badge>}
            {detail?.version && <Badge variant="outline">{detail.version}</Badge>}
          </div>
          {detail?.notes && (
            <div>
              <p className="mb-1 text-sm font-semibold">Notas</p>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{detail.notes}</p>
            </div>
          )}
          {detail?.lyrics ? (
            <div>
              <p className="mb-1 text-sm font-semibold">Letra</p>
              <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg bg-zinc-950 p-4 font-sans text-sm scrollbar-thin">
                {detail.lyrics}
              </pre>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Esta canción todavía no tiene letra cargada.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar canción' : 'Nueva canción'}</DialogTitle>
            <DialogDescription>Completa los datos de la canción.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Tabs defaultValue="general">
              <TabsList className="w-full">
                <TabsTrigger value="general" className="flex-1">General</TabsTrigger>
                <TabsTrigger value="letra" className="flex-1">Letra</TabsTrigger>
                <TabsTrigger value="recursos" className="flex-1">Recursos</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="title">Título *</Label>
                  <Input id="title" {...register('title')} />
                  {errors.title && <p className="text-xs text-red-400">{errors.title.message}</p>}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="author">Autor</Label>
                    <Input id="author" {...register('author')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="version">Versión</Label>
                    <Input id="version" placeholder="Ej: Acústica" {...register('version')} />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="song_key">Tonalidad</Label>
                    <Input id="song_key" placeholder="G" {...register('song_key')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bpm">BPM</Label>
                    <Input id="bpm" type="number" min={1} max={400} placeholder="72" {...register('bpm')} />
                    {errors.bpm && <p className="text-xs text-red-400">{errors.bpm.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="duration">Duración</Label>
                    <Input id="duration" placeholder="4:35" {...register('duration')} />
                    {errors.duration && <p className="text-xs text-red-400">{errors.duration.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="capo">Capotraste</Label>
                    <Input id="capo" placeholder="2" {...register('capo')} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="notes">Notas</Label>
                  <Textarea id="notes" rows={3} placeholder="Indicaciones para el equipo…" {...register('notes')} />
                </div>
              </TabsContent>

              <TabsContent value="letra">
                <div className="space-y-1.5">
                  <Label htmlFor="lyrics">Letra</Label>
                  <Textarea id="lyrics" rows={12} className="font-mono text-xs" {...register('lyrics')} />
                </div>
              </TabsContent>

              <TabsContent value="recursos" className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="spotify_url">Link de Spotify</Label>
                  <Input id="spotify_url" placeholder="https://open.spotify.com/track/…" {...register('spotify_url')} />
                  {errors.spotify_url && <p className="text-xs text-red-400">{errors.spotify_url.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="youtube_url">Link de YouTube</Label>
                  <Input id="youtube_url" placeholder="https://youtube.com/watch?v=…" {...register('youtube_url')} />
                  {errors.youtube_url && <p className="text-xs text-red-400">{errors.youtube_url.message}</p>}
                </div>
                <p className="rounded-lg border border-border bg-zinc-950 p-3 text-xs text-muted-foreground">
                  Para adjuntar PDF, partitura o audio, súbelos primero en <b>Archivos</b> y pega aquí la ruta que
                  aparece en la tarjeta del archivo.
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="pdf_path">Ruta del PDF</Label>
                    <Input id="pdf_path" {...register('pdf_path')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="score_path">Ruta de la partitura</Label>
                    <Input id="score_path" {...register('score_path')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="audio_path">Ruta del audio</Label>
                    <Input id="audio_path" {...register('audio_path')} />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {editing ? 'Guardar cambios' : 'Agregar canción'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title={`¿Eliminar “${toDelete?.title}”?`}
        description="La canción se quitará también de los ensayos, cultos y eventos donde esté programada."
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await deleteSong(toDelete.id);
            toast.success('Canción eliminada');
            songs.reload();
          } catch (err) {
            toast.error('No se pudo eliminar', errorMessage(err));
          } finally {
            setToDelete(null);
          }
        }}
      />
    </PageHeader>
  );
}
