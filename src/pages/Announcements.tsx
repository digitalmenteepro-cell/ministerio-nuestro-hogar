import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Megaphone, Pencil, Plus, Send, Trash2 } from 'lucide-react';
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
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import {
  createAnnouncement, deleteAnnouncement, listAnnouncements, listNotificationLogs,
  sendNotification, updateAnnouncement,
} from '@/services/announcements.service';
import { errorMessage } from '@/lib/utils';
import { sendPushNotification } from '@/lib/notifications';
import type { Announcement, NotificationChannel } from '@/types';

const CHANNELS: Array<{ id: NotificationChannel; label: string }> = [
  { id: 'push', label: 'Push' },
  { id: 'email', label: 'Correo' },
  { id: 'whatsapp', label: 'WhatsApp' },
];

export function Announcements() {
  const { profile, isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const announcements = useAsync(() => listAnnouncements(!isAdmin), [isAdmin]);
  const logs = useAsync(() => (isAdmin ? listNotificationLogs(20) : Promise.resolve([])), [isAdmin]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [published, setPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Announcement | null>(null);
  const [sendFor, setSendFor] = useState<Announcement | null>(null);
  const [channels, setChannels] = useState<NotificationChannel[]>(['push']);
  const [sending, setSending] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    const announcementId = params.get('announcement');
    if (!announcementId || announcements.loading || !announcements.data) return;
    const announcement = announcements.data.find((item) => item.id === announcementId);
    if (announcement) setSelectedAnnouncement(announcement);
  }, [announcements.data, announcements.loading, params]);

  const closeAnnouncement = () => {
    setSelectedAnnouncement(null);
    if (params.has('announcement')) {
      const nextParams = new URLSearchParams(params);
      nextParams.delete('announcement');
      setParams(nextParams, { replace: true });
    }
  };

  const openAnnouncement = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
  };

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setBody('');
    setPublished(true);
    setOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setTitle(a.title);
    setBody(a.body);
    setPublished(a.published);
    setOpen(true);
  };

  const save = async () => {
    if (!profile) return;
    if (!title.trim() || !body.trim()) {
      toast.error('Completa el título y el mensaje');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateAnnouncement(editing.id, { title: title.trim(), body: body.trim(), published });
        toast.success('Anuncio actualizado');
        if (published && !editing.published) {
          try {
            await sendPushNotification({
              title: 'Nuevo anuncio',
              message: title.trim() || 'Se ha publicado un nuevo anuncio en Nuestro Hogar.',
              url: `https://ministerio-nuestro-hogar.vercel.app/anuncios?announcement=${editing.id}`,
            });
          } catch {
            toast.error('Anuncio guardado', 'No se pudo enviar la notificación push.');
          }
        }
      } else {
        const createdAnnouncement = await createAnnouncement(
          { title: title.trim(), body: body.trim(), published },
          profile.id,
        );
        toast.success('Anuncio creado');
        if (published) {
          try {
            await sendPushNotification({
              title: 'Nuevo anuncio',
              message: title.trim() || 'Se ha publicado un nuevo anuncio en Nuestro Hogar.',
              url: `https://ministerio-nuestro-hogar.vercel.app/anuncios?announcement=${createdAnnouncement.id}`,
            });
          } catch {
            toast.error('Anuncio guardado', 'No se pudo enviar la notificación push.');
          }
        }
      }
      setOpen(false);
      announcements.reload();
    } catch (err) {
      toast.error('No se pudo guardar', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const send = async () => {
    if (!sendFor || channels.length === 0) return;
    setSending(true);
    try {
      const result = await sendNotification({
        channels,
        subject: sendFor.title,
        body: sendFor.body,
        announcement_id: sendFor.id,
      });
      toast.success('Notificación encolada', `${result.queued} envíos registrados.`);
      setSendFor(null);
      logs.reload();
    } catch (err) {
      toast.error('No se pudo enviar', errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <PageHeader
      title="Anuncios"
      description="Comunicaciones y notificaciones del ministerio."
      action={
        isAdmin ? (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo anuncio
          </Button>
        ) : undefined
      }
    >
      {announcements.loading && <SkeletonTable rows={3} />}
      {announcements.error && <ErrorState message={announcements.error} onRetry={announcements.reload} />}

      {announcements.data?.length === 0 && (
        <EmptyState
          icon={Megaphone}
          title="No hay anuncios"
          description={
            isAdmin
              ? 'Crea el primer anuncio para comunicar algo al equipo.'
              : 'Cuando haya novedades, aparecerán aquí.'
          }
          action={
            isAdmin ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Nuevo anuncio
              </Button>
            ) : undefined
          }
        />
      )}

      <div className="space-y-2">
        {(announcements.data ?? []).map((a) => (
          <Card
            key={a.id}
            className="cursor-pointer transition-colors hover:border-brand-400/60"
            role="button"
            tabIndex={0}
            onClick={() => openAnnouncement(a)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openAnnouncement(a);
              }
            }}
          >
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{a.title}</p>
                    {!a.published && <Badge variant="secondary">Borrador</Badge>}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
                  <p className="mt-2 text-xs text-zinc-600">
                    {format(new Date(a.created_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
                  </p>
                </div>

                {isAdmin && (
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" aria-label="Enviar" onClick={(event) => { event.stopPropagation(); setSendFor(a); }}>
                      <Send className="h-4 w-4 text-brand-300" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Editar" onClick={(event) => { event.stopPropagation(); openEdit(a); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Eliminar" onClick={(event) => { event.stopPropagation(); setToDelete(a); }}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isAdmin && (logs.data?.length ?? 0) > 0 && (
        <Card className="mt-6">
          <CardContent className="pt-5">
            <p className="mb-3 font-semibold">Historial de notificaciones</p>
            <div className="space-y-1.5">
              {(logs.data ?? []).map((l) => (
                <div
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-xs"
                >
                  <span className="truncate">
                    <b>{l.channel}</b> · {l.subject ?? '—'} · {l.recipient ?? 'todos'}
                  </span>
                  <div className="flex items-center gap-2">
                    {l.error && <span className="text-red-400">{l.error}</span>}
                    <Badge
                      variant={
                        l.status === 'sent' ? 'success' : l.status === 'failed' ? 'destructive' : 'secondary'
                      }
                    >
                      {l.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedAnnouncement} onOpenChange={(value) => !value && closeAnnouncement()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-brand-400/40 bg-background sm:max-w-2xl">
          <DialogHeader className="gap-4">
            <Badge className="w-fit bg-brand-500/15 text-brand-200 hover:bg-brand-500/15">ANUNCIO</Badge>
            <DialogTitle className="text-2xl leading-tight sm:text-3xl">
              {selectedAnnouncement?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedAnnouncement && format(new Date(selectedAnnouncement.created_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
            </DialogDescription>
          </DialogHeader>
          <div className="whitespace-pre-wrap rounded-xl border border-brand-400/20 bg-brand-950/20 p-5 text-base leading-7 text-foreground">
            {selectedAnnouncement?.body}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create / edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar anuncio' : 'Nuevo anuncio'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="a_title">Título</Label>
              <Input id="a_title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a_body">Mensaje</Label>
              <Textarea id="a_body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Publicar de inmediato (visible para todos los integrantes)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={() => void save()}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send notification */}
      <Dialog open={!!sendFor} onOpenChange={(v) => !v && setSendFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar notificación</DialogTitle>
            <DialogDescription>
              Se enviará “{sendFor?.title}” a todos los integrantes activos por los canales seleccionados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {CHANNELS.map((c) => (
              <label key={c.id} className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={channels.includes(c.id)}
                  onChange={(e) =>
                    setChannels((prev) =>
                      e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id),
                    )
                  }
                />
                {c.label}
              </label>
            ))}
          </div>

          <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-3 text-xs text-amber-200">
            Los envíos reales requieren credenciales externas (proveedor de push, correo y WhatsApp) configuradas
            como secretos de la Edge Function. Sin ellas, cada intento se registra en el historial con estado{' '}
            <b>failed</b> y el motivo.
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSendFor(null)}>
              Cancelar
            </Button>
            <Button loading={sending} disabled={channels.length === 0} onClick={() => void send()}>
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title={`¿Eliminar “${toDelete?.title}”?`}
        description="El anuncio dejará de estar visible para el equipo."
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await deleteAnnouncement(toDelete.id);
            toast.success('Anuncio eliminado');
            announcements.reload();
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
