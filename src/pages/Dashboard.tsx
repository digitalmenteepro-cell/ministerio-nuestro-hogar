import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, Music2, TrendingUp, Users } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton, SkeletonCards } from '@/components/ui/skeleton';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/contexts/AuthContext';
import { dashboardStats } from '@/services/attendance.service';
import { listUpcomingEvents } from '@/services/events.service';
import { listAnnouncements } from '@/services/announcements.service';
import { EVENT_TYPE_LABEL } from '@/types';

export function Dashboard() {
  const { profile } = useAuth();
  const stats = useAsync(() => dashboardStats(), []);
  const events = useAsync(() => listUpcomingEvents(5), []);
  const announcements = useAsync(() => listAnnouncements(true), []);

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
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Próximas actividades</CardTitle>
            <Link to="/calendario" className="text-xs text-brand-300 hover:underline">
              Ver calendario
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {events.loading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            {events.error && <p className="text-sm text-red-400">{events.error}</p>}
            {events.data?.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No hay actividades programadas.</p>
            )}
            {events.data?.map((e) => (
              <Link
                key={e.id}
                to={`/calendario?event=${e.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(e.starts_at), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
                  </p>
                </div>
                <Badge variant={e.event_type === 'service' ? 'default' : e.event_type === 'special' ? 'warning' : 'secondary'}>
                  {EVENT_TYPE_LABEL[e.event_type]}
                </Badge>
              </Link>
            ))}
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
