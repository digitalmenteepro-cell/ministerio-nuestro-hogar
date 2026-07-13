import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Check, Clock, MapPin, Music2, Plus, User, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import { addSongToEvent, listEventSongs, removeSongFromEvent } from '@/services/events.service';
import { listSongs } from '@/services/songs.service';
import { listEventAttendance, respondAttendance } from '@/services/attendance.service';
import { errorMessage, formatDuration, fullName } from '@/lib/utils';
import { ATTENDANCE_LABEL, EVENT_TYPE_LABEL, type AttendanceStatus, type MinistryEvent } from '@/types';

const STATUS_STYLE: Record<AttendanceStatus, 'success' | 'destructive' | 'warning' | 'secondary'> = {
  attending: 'success',
  not_attending: 'destructive',
  late: 'warning',
  unable: 'secondary',
};

interface Props {
  event: MinistryEvent | null;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}

export function EventDetail({ event, onOpenChange, onChanged }: Props) {
  const { profile, isAdmin } = useAuth();
  const toast = useToast();
  const eventId = event?.id ?? '';

  const setlist = useAsync(() => (eventId ? listEventSongs(eventId) : Promise.resolve([])), [eventId]);
  const attendance = useAsync(() => (eventId ? listEventAttendance(eventId) : Promise.resolve([])), [eventId]);
  const songs = useAsync(() => listSongs(), []);
  const [adding, setAdding] = useState('');

  if (!event) return null;

  const myResponse = attendance.data?.find((a) => a.profile_id === profile?.id);

  const respond = async (status: AttendanceStatus) => {
    if (!profile) return;
    try {
      await respondAttendance(event.id, profile.id, status);
      toast.success('Respuesta registrada', ATTENDANCE_LABEL[status]);
      attendance.reload();
      onChanged();
    } catch (err) {
      toast.error('No se pudo registrar tu respuesta', errorMessage(err));
    }
  };

  const addSong = async (songId: string) => {
    try {
      await addSongToEvent(event.id, songId, (setlist.data?.length ?? 0) + 1);
      toast.success('Canción agregada al evento');
      setAdding('');
      setlist.reload();
    } catch (err) {
      toast.error('No se pudo agregar la canción', errorMessage(err));
    }
  };

  const removeSong = async (songId: string) => {
    try {
      await removeSongFromEvent(event.id, songId);
      setlist.reload();
    } catch (err) {
      toast.error('No se pudo quitar la canción', errorMessage(err));
    }
  };

  const available = (songs.data ?? []).filter(
    (s) => !(setlist.data ?? []).some((item) => item.song_id === s.id),
  );

  return (
    <Dialog open={!!event} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant={event.event_type === 'special' ? 'warning' : 'default'}>
              {EVENT_TYPE_LABEL[event.event_type]}
            </Badge>
          </div>
          <DialogTitle>{event.title}</DialogTitle>
          <DialogDescription>
            {format(new Date(event.starts_at), "EEEE d 'de' MMMM yyyy, HH:mm", { locale: es })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {event.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> {event.location}
            </span>
          )}
          {event.ends_at && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Hasta {format(new Date(event.ends_at), 'HH:mm')}
            </span>
          )}
          {event.responsible && (
            <span className="flex items-center gap-1.5">
              <User className="h-4 w-4" /> {fullName(event.responsible)}
            </span>
          )}
        </div>

        {event.description && <p className="text-sm">{event.description}</p>}
        {event.preacher && (
          <p className="text-sm">
            <b>Predicador:</b> {event.preacher}
          </p>
        )}

        <div className="rounded-lg border border-border p-4">
          <p className="mb-3 text-sm font-semibold">Tu asistencia</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ATTENDANCE_LABEL) as AttendanceStatus[]).map((status) => (
              <Button
                key={status}
                size="sm"
                variant={myResponse?.status === status ? 'default' : 'outline'}
                onClick={() => void respond(status)}
              >
                {myResponse?.status === status && <Check className="h-3.5 w-3.5" />}
                {ATTENDANCE_LABEL[status]}
              </Button>
            ))}
          </div>
        </div>

        <Tabs defaultValue="setlist">
          <TabsList className="w-full">
            <TabsTrigger value="setlist" className="flex-1">
              Repertorio ({setlist.data?.length ?? 0})
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="asistencia" className="flex-1">
                Asistencia ({attendance.data?.length ?? 0})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="setlist" className="space-y-2">
            {setlist.loading && <Skeleton className="h-20 w-full" />}
            {setlist.data?.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Todavía no hay canciones asignadas a este evento.
              </p>
            )}

            {(setlist.data ?? []).map((item, index) => (
              <div key={item.song_id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">{index + 1}</span>
                <Music2 className="h-4 w-4 shrink-0 text-brand-300" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.song?.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.song?.author || 'Autor desconocido'}
                    {item.song?.song_key ? ` · Tono ${item.song.song_key}` : ''}
                    {item.song?.duration_seconds != null ? ` · ${formatDuration(item.song.duration_seconds)}` : ''}
                  </p>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Quitar del evento"
                    onClick={() => void removeSong(item.song_id)}
                  >
                    <X className="h-4 w-4 text-red-400" />
                  </Button>
                )}
              </div>
            ))}

            {isAdmin && (
              <div className="flex gap-2 pt-2">
                <Select value={adding} onValueChange={setAdding}>
                  <SelectTrigger>
                    <SelectValue placeholder="Agregar canción al evento…" />
                  </SelectTrigger>
                  <SelectContent>
                    {available.length === 0 ? (
                      <SelectItem value="__empty__" disabled>
                        No hay más canciones disponibles
                      </SelectItem>
                    ) : (
                      available.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  disabled={!adding || adding === '__empty__'}
                  onClick={() => void addSong(adding)}
                  aria-label="Agregar"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </TabsContent>

          {isAdmin && (
            <TabsContent value="asistencia" className="space-y-2">
              {attendance.loading && <Skeleton className="h-20 w-full" />}
              {attendance.data?.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">Nadie ha respondido todavía.</p>
              )}
              {(attendance.data ?? []).map((a) => (
                <div
                  key={a.profile_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <span className="truncate text-sm">{fullName(a.profile)}</span>
                  <Badge variant={STATUS_STYLE[a.status]}>{ATTENDANCE_LABEL[a.status]}</Badge>
                </div>
              ))}
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
