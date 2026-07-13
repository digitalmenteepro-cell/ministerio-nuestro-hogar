import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton, SkeletonCards } from '@/components/ui/skeleton';
import { useAsync } from '@/hooks/useAsync';
import { attendanceByUser, dashboardStats } from '@/services/attendance.service';

const COLORS = ['#590776', '#9b52c4', '#d5b3e7'];

const TOOLTIP_STYLE = {
  backgroundColor: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: 12,
  fontSize: 12,
} as const;

export function Stats() {
  const stats = useAsync(() => dashboardStats(), []);
  const byUser = useAsync(() => attendanceByUser({}), []);

  const eventData = stats.data
    ? [
        { name: 'Ensayos', total: stats.data.rehearsals },
        { name: 'Cultos', total: stats.data.services },
        { name: 'Eventos', total: stats.data.specials },
      ]
    : [];

  const topMembers = (byUser.data ?? [])
    .slice()
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 8)
    .map((r) => ({ name: r.full_name.split(' ')[0], rate: Math.round(r.rate) }));

  const hasEvents = eventData.some((d) => d.total > 0);

  return (
    <PageHeader title="Estadísticas" description="Indicadores de actividad y asistencia del ministerio.">
      {stats.loading && <SkeletonCards />}
      {stats.error && <ErrorState message={stats.error} onRetry={stats.reload} />}

      {stats.data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Integrantes', value: stats.data.total_members },
              { label: 'Activos', value: stats.data.active_members },
              { label: 'Canciones', value: stats.data.total_songs },
              { label: 'Asistencia media', value: `${Math.round(stats.data.attendance_rate)}%` },
            ].map((c) => (
              <Card key={c.label}>
                <CardContent className="pt-5">
                  <p className="text-sm text-muted-foreground">{c.label}</p>
                  <p className="mt-1 text-2xl font-bold">{c.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {!hasEvents && (byUser.data?.length ?? 0) === 0 ? (
            <div className="mt-6">
              <EmptyState
                icon={BarChart3}
                title="Aún no hay datos suficientes"
                description="Cuando registres eventos y el equipo confirme asistencia, los gráficos aparecerán aquí."
              />
            </div>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Eventos por tipo</CardTitle>
                </CardHeader>
                <CardContent className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={eventData}
                        dataKey="total"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      >
                        {eventData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Asistencia por integrante (%)</CardTitle>
                </CardHeader>
                <CardContent className="h-[320px]">
                  {byUser.loading && <Skeleton className="h-full w-full" />}
                  {byUser.error && <p className="text-sm text-red-400">{byUser.error}</p>}
                  {byUser.data && topMembers.length === 0 && (
                    <p className="grid h-full place-items-center text-sm text-muted-foreground">
                      Sin respuestas de asistencia todavía.
                    </p>
                  )}
                  {topMembers.length > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topMembers}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} />
                        <YAxis stroke="#a1a1aa" fontSize={12} domain={[0, 100]} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#27272a' }} />
                        <Bar dataKey="rate" fill="#590776" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </PageHeader>
  );
}
