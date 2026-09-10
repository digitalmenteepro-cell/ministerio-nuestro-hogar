import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  addDays, addMonths, addWeeks, eachDayOfInterval, endOfDay, endOfMonth, endOfWeek,
  format, isSameDay, isSameMonth, isToday, startOfDay, startOfMonth, startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EventDialog } from '@/features/events/EventDialog';
import { EventDetail } from '@/features/events/EventDetail';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import { deleteEvent, listEvents } from '@/services/events.service';
import { sendPushNotification } from '@/lib/notifications';
import { cn, errorMessage } from '@/lib/utils';
import { EVENT_TYPE_LABEL, type MinistryEvent } from '@/types';

type ViewMode = 'month' | 'week' | 'day';

const TYPE_COLOR: Record<string, string> = {
  rehearsal: 'bg-brand/70',
  service: 'bg-emerald-600/70',
  special: 'bg-amber-600/70',
};

export function CalendarPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const [view, setView] = useState<ViewMode>('month');
  const [cursor, setCursor] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MinistryEvent | null>(null);
  const [toDelete, setToDelete] = useState<MinistryEvent | null>(null);
  const [toRemind, setToRemind] = useState<MinistryEvent | null>(null);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);

  // Query window covers the visible range for the current view.
  const { from, to } = useMemo(() => {
    if (view === 'month') {
      return {
        from: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
        to: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
      };
    }
    if (view === 'week') {
      return {
        from: startOfWeek(cursor, { weekStartsOn: 1 }),
        to: endOfWeek(cursor, { weekStartsOn: 1 }),
      };
    }
    return { from: startOfDay(cursor), to: endOfDay(cursor) };
  }, [view, cursor]);

  const events = useAsync(
    () => listEvents({ from: from.toISOString(), to: to.toISOString() }),
    [from.toISOString(), to.toISOString()],
  );

  const selectedId = params.get('event');
  const selected = (events.data ?? []).find((e) => e.id === selectedId) ?? null;

  const days = useMemo(() => eachDayOfInterval({ start: from, end: to }), [from, to]);

  const eventsOn = (day: Date) =>
    (events.data ?? []).filter((e) => isSameDay(new Date(e.starts_at), day));

  const shift = (dir: 1 | -1) => {
    if (view === 'month') setCursor((c) => addMonths(c, dir));
    else if (view === 'week') setCursor((c) => addWeeks(c, dir));
    else setCursor((c) => addDays(c, dir));
  };

  const openDetail = (e: MinistryEvent) => {
    params.set('event', e.id);
    setParams(params, { replace: true });
  };

  const closeDetail = () => {
    params.delete('event');
    setParams(params, { replace: true });
  };

  const openCreate = (date?: Date) => {
    setEditing(null);
    setCursor(date ?? cursor);
    setDialogOpen(true);
  };

  const title =
    view === 'day'
      ? format(cursor, "EEEE d 'de' MMMM yyyy", { locale: es })
      : view === 'week'
        ? `${format(from, 'd MMM', { locale: es })} – ${format(to, 'd MMM yyyy', { locale: es })}`
        : format(cursor, 'MMMM yyyy', { locale: es });

  const reminderMessage = toRemind
    ? isToday(new Date(toRemind.starts_at))
      ? `🔔 Recuerda: tienes ensayo hoy a ${format(new Date(toRemind.starts_at), 'HH:mm')}. Revisa el repertorio y confirma tu asistencia.`
      : `🔔 Recuerda: tienes ensayo el ${format(new Date(toRemind.starts_at), "EEEE d 'de' MMMM", { locale: es })} a ${format(new Date(toRemind.starts_at), 'HH:mm')}. Revisa el repertorio y confirma tu asistencia.`
    : '';

  return (
    <PageHeader
      title="Calendario"
      description="Ensayos, cultos y eventos especiales."
      action={
        isAdmin ? (
          <Button onClick={() => openCreate()}>
            <Plus className="h-4 w-4" />
            Nuevo evento
          </Button>
        ) : undefined
      }
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon" aria-label="Anterior" onClick={() => shift(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="icon" aria-label="Siguiente" onClick={() => shift(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <p className="ml-2 font-semibold capitalize">{title}</p>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>
            Hoy
          </Button>
        </div>

        <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
          <TabsList>
            <TabsTrigger value="month">Mes</TabsTrigger>
            <TabsTrigger value="week">Semana</TabsTrigger>
            <TabsTrigger value="day">Día</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {events.loading && <Skeleton className="h-[520px] w-full" />}
      {events.error && <ErrorState message={events.error} onRetry={events.reload} />}

      {events.data && view === 'month' && (
        <Card>
          <CardContent className="p-3">
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {days.map((day) => {
                const dayEvents = eventsOn(day);
                return (
                  <button
                    type="button"
                    key={day.toISOString()}
                    onDoubleClick={() => isAdmin && openCreate(day)}
                    onClick={() => {
                      setCursor(day);
                      setView('day');
                    }}
                    className={cn(
                      'min-h-[92px] rounded-lg border p-1.5 text-left transition-colors hover:bg-accent',
                      isSameMonth(day, cursor) ? 'border-border' : 'border-transparent opacity-40',
                      isToday(day) && 'border-brand ring-1 ring-brand',
                    )}
                  >
                    <span
                      className={cn(
                        'text-xs font-medium',
                        isToday(day) ? 'text-brand-300' : 'text-muted-foreground',
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    <div className="mt-1 space-y-1">
                      {dayEvents.slice(0, 2).map((e) => (
                        <span
                          key={e.id}
                          className={cn(
                            'block truncate rounded px-1.5 py-0.5 text-[10px] text-white',
                            TYPE_COLOR[e.event_type],
                          )}
                        >
                          {format(new Date(e.starts_at), 'HH:mm')} {e.title}
                        </span>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="block text-[10px] text-muted-foreground">
                          +{dayEvents.length - 2} más
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {events.data && view === 'week' && (
        <div className="grid gap-2 md:grid-cols-7">
          {days.map((day) => {
            const dayEvents = eventsOn(day);
            return (
              <Card key={day.toISOString()} className={cn(isToday(day) && 'ring-1 ring-brand')}>
                <CardContent className="p-3">
                  <p className="mb-2 text-xs font-semibold capitalize text-muted-foreground">
                    {format(day, 'EEE d', { locale: es })}
                  </p>
                  <div className="space-y-1.5">
                    {dayEvents.length === 0 && <p className="text-[11px] text-zinc-600">—</p>}
                    {dayEvents.map((e) => (
                      <button
                        type="button"
                        key={e.id}
                        onClick={() => openDetail(e)}
                        className={cn(
                          'block w-full truncate rounded px-2 py-1.5 text-left text-[11px] text-white',
                          TYPE_COLOR[e.event_type],
                        )}
                      >
                        {format(new Date(e.starts_at), 'HH:mm')} · {e.title}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {events.data && view === 'day' && (
        <div className="space-y-2">
          {eventsOn(cursor).length === 0 && (
            <EmptyState
              icon={CalendarDays}
              title="Sin actividades este día"
              description={`No hay eventos programados para el ${format(cursor, "d 'de' MMMM", { locale: es })}.`}
              action={
                isAdmin ? (
                  <Button onClick={() => openCreate(cursor)}>
                    <Plus className="h-4 w-4" />
                    Crear evento
                  </Button>
                ) : undefined
              }
            />
          )}

          {eventsOn(cursor).map((e) => (
            <Card key={e.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="shrink-0 text-center">
                  <p className="text-lg font-bold">{format(new Date(e.starts_at), 'HH:mm')}</p>
                  {e.ends_at && (
                    <p className="text-xs text-muted-foreground">{format(new Date(e.ends_at), 'HH:mm')}</p>
                  )}
                </div>
                <button type="button" onClick={() => openDetail(e)} className="min-w-0 flex-1 text-left">
                  <p className="truncate font-medium">{e.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{e.location || 'Sin lugar definido'}</p>
                </button>
                <Badge variant={e.event_type === 'special' ? 'warning' : 'default'}>
                  {EVENT_TYPE_LABEL[e.event_type]}
                </Badge>
                {isAdmin && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar"
                      onClick={() => {
                        setEditing(e);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {e.event_type === 'rehearsal' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Enviar recordatorio de ensayo"
                        disabled={sendingReminderId === e.id}
                        onClick={() => setToRemind(e)}
                      >
                        <Bell className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" aria-label="Eliminar" onClick={() => setToDelete(e)}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={editing}
        defaultDate={cursor}
        onSaved={events.reload}
      />

      <EventDetail event={selected} onOpenChange={(v) => !v && closeDetail()} onChanged={events.reload} />

      <ConfirmDialog
        open={!!toRemind}
        onOpenChange={(v) => !v && setToRemind(null)}
        title="Enviar recordatorio de ensayo"
        description={reminderMessage}
        confirmLabel="Enviar recordatorio"
        onConfirm={async () => {
          if (!toRemind || sendingReminderId) return;
          setSendingReminderId(toRemind.id);
          try {
            await sendPushNotification({
              title: '🔔 Recordatorio de ensayo',
              message: reminderMessage,
              url: `/calendario?event=${toRemind.id}`,
            });
            toast.success('Recordatorio enviado');
          } catch {
            toast.error('No se pudo enviar el recordatorio');
          } finally {
            setSendingReminderId(null);
          }
        }}
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title={`¿Eliminar “${toDelete?.title}”?`}
        description="Se eliminará el evento junto con su repertorio asignado y las respuestas de asistencia."
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await deleteEvent(toDelete.id);
            toast.success('Evento eliminado');
            events.reload();
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
