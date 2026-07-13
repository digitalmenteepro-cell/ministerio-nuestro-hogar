import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ClipboardCheck } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SkeletonTable } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAsync } from '@/hooks/useAsync';
import { attendanceByEvent, attendanceByUser } from '@/services/attendance.service';
import { EVENT_TYPE_LABEL, type EventType } from '@/types';

const ALL = '__all__';

/** Admin view: attendance statistics by user, by event and by period. */
export function Attendance() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState<string>(ALL);

  const filters = {
    from: from || undefined,
    to: to || undefined,
    event_type: type === ALL ? undefined : type,
  };

  const byUser = useAsync(() => attendanceByUser(filters), [from, to, type]);
  const byEvent = useAsync(() => attendanceByEvent(filters), [from, to, type]);

  return (
    <PageHeader title="Asistencia" description="Estadísticas de asistencia por integrante, evento y periodo.">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="from">Desde</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">Hasta</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de evento</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {(Object.keys(EVENT_TYPE_LABEL) as EventType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {EVENT_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="user">
        <TabsList>
          <TabsTrigger value="user">Por integrante</TabsTrigger>
          <TabsTrigger value="event">Por evento</TabsTrigger>
        </TabsList>

        <TabsContent value="user" className="space-y-2">
          {byUser.loading && <SkeletonTable rows={5} />}
          {byUser.error && <ErrorState message={byUser.error} onRetry={byUser.reload} />}
          {byUser.data?.length === 0 && (
            <EmptyState
              icon={ClipboardCheck}
              title="Sin datos de asistencia"
              description="Todavía no hay respuestas registradas para el periodo seleccionado."
            />
          )}
          {(byUser.data ?? []).map((row) => (
            <Card key={row.profile_id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <p className="min-w-0 flex-1 truncate font-medium">{row.full_name}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="success">Asistiré: {row.attending}</Badge>
                  <Badge variant="warning">Tarde: {row.late}</Badge>
                  <Badge variant="destructive">No asistiré: {row.not_attending}</Badge>
                  <Badge variant="secondary">No puedo: {row.unable}</Badge>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-bold">{Math.round(row.rate)}%</p>
                  <p className="text-xs text-muted-foreground">de {row.total} eventos</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="event" className="space-y-2">
          {byEvent.loading && <SkeletonTable rows={5} />}
          {byEvent.error && <ErrorState message={byEvent.error} onRetry={byEvent.reload} />}
          {byEvent.data?.length === 0 && (
            <EmptyState
              icon={ClipboardCheck}
              title="Sin eventos en el periodo"
              description="Ajusta los filtros para ver la asistencia por evento."
            />
          )}
          {(byEvent.data ?? []).map((row) => (
            <Card key={row.event_id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{row.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(row.starts_at), "d MMM yyyy, HH:mm", { locale: es })} ·{' '}
                    {EVENT_TYPE_LABEL[row.event_type as EventType] ?? row.event_type}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="success">{row.attending}</Badge>
                  <Badge variant="warning">{row.late}</Badge>
                  <Badge variant="destructive">{row.not_attending}</Badge>
                  <Badge variant="secondary">{row.unable}</Badge>
                  <Badge variant="outline">Sin responder: {row.no_response}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </PageHeader>
  );
}
