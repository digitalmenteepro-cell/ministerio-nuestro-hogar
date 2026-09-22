import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowRight, CalendarDays, MapPin, Music2, TrendingUp, Users } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton, SkeletonCards } from '@/components/ui/skeleton';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/contexts/AuthContext';
import { dashboardStats } from '@/services/attendance.service';
import { listEventSongs, listUpcomingEvents } from '@/services/events.service';
import { listAnnouncements } from '@/services/announcements.service';
import { EVENT_TYPE_LABEL } from '@/types';

export function Dashboard() {
  const { profile } = useAuth();
  const stats = useAsync(() => dashboardStats(), []);
  const events = useAsync(() => listUpcomingEvents(5), []);
  const nextEvent = events.data?.[0] ?? null;
  const repertoire = useAsync(
    () => (nextEvent ? listEventSongs(nextEvent.id) : Promise.resolve([])),
    [nextEvent?.id],
  );
  const announcements = useAsync(() => listAnnouncements(true), []);

  const nextEventLabel = nextEvent?.event_type === 'rehearsal'
    ? 'Próximo ensayo'
    : nextEvent?.event_type === 'service'
      ? 'Próximo culto'
      : 'Próxima actividad';
  const nextEventIcon = nextEvent?.event_type === 'rehearsal'
    ? '🎵'
    : nextEvent?.event_type === 'service'
      ? '⛪'
      : '📅';

  const cards = stats.data
    ? [
        { label: 'Integrantes activos', value: String(stats.data.active_members), icon: Users },
        { label: 'Canciones', value: String(stats.data.total_songs), icon: Music2 },
        { label: 'Próximos eventos', value: String(stats.data.upcoming_events), icon: CalendarDays },
        { label: 'Asistencia', value: `${Math.round(stats.data.attendance_rate)}%`, icon: TrendingUp },
      ]
    : [];

  return (
    <PageHeader
      title={`Hola, ${profile?.first_name || 'bienvenido'}`}
      description="Este es el resumen del ministerio."
    >
      {stats.loading && <SkeletonCards />}
      {stats.error && <ErrorState message={stats.error} onRetry={stats.reload} />}
      {stats.data && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="pt-5">
                <Icon className="mb-3 h-5 w-5 text-brand-300" aria-hidden />
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-bold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden border-brand/40 bg-gradient-to-br from-brand/15 via-card to-card shadow-lg shadow-brand/5">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">{nextEventLabel}</p>
              <CardTitle className="mt-2 text-xl">{nextEvent?.title ?? 'Agenda del ministerio'}</CardTitle>
            </div>
            <span className="text-3xl" aria-hidden>{nextEventIcon}</span>
          </CardHeader>
          <CardContent>
            {events.loading && <Skeleton className="h-28 w-full" />}
            {events.data?.length === 0 && (
              <p className="py-6 text-sm text-muted-foreground">Todavía no hay próximas actividades programadas.</p>
            )}
            {nextEvent && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <p className="font-medium capitalize text-foreground">
                    {format(new Date(nextEvent.starts_at), "EEEE d 'de' MMMM · HH:mm", { locale: es })}
                  </p>
                  {nextEvent.location && (
                    <p className="flex items-center gap-2">
                      <MapPin className="size-4 text-brand-300" aria-hidden />
                      {nextEvent.location}
                    </p>
                  )}
                  {!repertoire.loading && (repertoire.data?.length ?? 0) > 0 && (
                    <p>{repertoire.data?.length} canciones en el repertorio</p>
                  )}
                </div>
                <Link
                  to={`/calendario?event=${nextEvent.id}`}
                  className="inline-flex w-fit items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand/90"
                >
                  Ver {EVENT_TYPE_LABEL[nextEvent.event_type].toLowerCase()}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Anuncios</CardTitle>
            <Link to="/anuncios" className="text-xs text-brand-300 hover:underline">
              Ver todos
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {announcements.loading && [0, 1].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            {announcements.error && <p className="text-sm text-red-400">{announcements.error}</p>}
            {announcements.data?.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No hay anuncios publicados.</p>
            )}
            {announcements.data?.slice(0, 4).map((a) => (
              <div key={a.id} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">{a.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {stats.data && stats.data.total_members === 0 && (
        <div className="mt-6">
          <EmptyState
            icon={Users}
            title="Aún no hay integrantes"
            description="Un administrador puede crear las cuentas del equipo desde la sección Integrantes."
          />
        </div>
      )}
    </PageHeader>
  );
}
