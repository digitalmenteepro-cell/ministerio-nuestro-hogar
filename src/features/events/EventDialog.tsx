import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import { listProfiles } from '@/services/profiles.service';
import { createEvent, updateEvent, type EventInput } from '@/services/events.service';
import { errorMessage, fullName } from '@/lib/utils';
import type { EventType, MinistryEvent } from '@/types';

const NONE = '__none__';

const schema = z.object({
  title: z.string().min(1, 'El título es obligatorio.'),
  event_type: z.enum(['rehearsal', 'service', 'special']),
  starts_at: z.string().min(1, 'La fecha y hora son obligatorias.'),
  ends_at: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  responsible_id: z.string().optional(),
  service_type: z.string().optional(),
  preacher: z.string().optional(),
  special_category: z.string().optional(),
  observations: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

/** `datetime-local` needs `yyyy-MM-ddTHH:mm` in local time. */
function toLocalInput(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd'T'HH:mm");
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  event: MinistryEvent | null;
  defaultDate?: Date;
  onSaved: () => void;
}

export function EventDialog({ open, onOpenChange, event, defaultDate, onSaved }: Props) {
  const { profile } = useAuth();
  const toast = useToast();
  const members = useAsync(() => listProfiles(false), []);

  const {
    register, handleSubmit, reset, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const eventType = watch('event_type');

  useEffect(() => {
    if (!open) return;
    if (event) {
      reset({
        title: event.title,
        event_type: event.event_type,
        starts_at: toLocalInput(event.starts_at),
        ends_at: event.ends_at ? toLocalInput(event.ends_at) : '',
        location: event.location ?? '',
        description: event.description ?? '',
        responsible_id: event.responsible_id ?? NONE,
        service_type: event.service_type ?? '',
        preacher: event.preacher ?? '',
        special_category: event.special_category ?? '',
        observations: event.observations ?? '',
      });
    } else {
      const base = defaultDate ? new Date(defaultDate) : new Date();
      base.setHours(19, 30, 0, 0);
      reset({
        title: '',
        event_type: 'rehearsal',
        starts_at: format(base, "yyyy-MM-dd'T'HH:mm"),
        ends_at: '',
        location: '',
        description: '',
        responsible_id: NONE,
        service_type: '',
        preacher: '',
        special_category: '',
        observations: '',
      });
    }
  }, [open, event, defaultDate, reset]);

  const onSubmit = async (values: FormValues) => {
    if (!profile) return;
    const clean = (s?: string) => (s?.trim() ? s.trim() : null);

    const payload: EventInput = {
      title: values.title.trim(),
      event_type: values.event_type,
      starts_at: new Date(values.starts_at).toISOString(),
      ends_at: values.ends_at ? new Date(values.ends_at).toISOString() : null,
      location: clean(values.location),
      description: clean(values.description),
      responsible_id: values.responsible_id === NONE ? null : (values.responsible_id ?? null),
      service_type: clean(values.service_type),
      preacher: clean(values.preacher),
      special_category: clean(values.special_category),
      observations: clean(values.observations),
    };

    try {
      if (event) {
        await updateEvent(event.id, payload);
        toast.success('Evento actualizado');
      } else {
        await createEvent(payload, profile.id);
        toast.success('Evento creado');
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error('No se pudo guardar el evento', errorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{event ? 'Editar evento' : 'Nuevo evento'}</DialogTitle>
          <DialogDescription>Ensayos, cultos y eventos especiales.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="e_title">Título *</Label>
            <Input id="e_title" {...register('title')} />
            {errors.title && <p className="text-xs text-red-400">{errors.title.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={eventType} onValueChange={(v) => setValue('event_type', v as EventType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rehearsal">Ensayo</SelectItem>
                  <SelectItem value="service">Culto</SelectItem>
                  <SelectItem value="special">Evento especial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e_location">Lugar</Label>
              <Input id="e_location" {...register('location')} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="e_starts">Inicio *</Label>
              <Input id="e_starts" type="datetime-local" {...register('starts_at')} />
              {errors.starts_at && <p className="text-xs text-red-400">{errors.starts_at.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e_ends">Término</Label>
              <Input id="e_ends" type="datetime-local" {...register('ends_at')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Responsable</Label>
            <Select value={watch('responsible_id') ?? NONE} onValueChange={(v) => setValue('responsible_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sin responsable" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin responsable</SelectItem>
                {(members.data ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {fullName(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {eventType === 'service' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="e_service">Tipo de culto</Label>
                <Input id="e_service" placeholder="Ej: Culto de jóvenes" {...register('service_type')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e_preacher">Predicador</Label>
                <Input id="e_preacher" {...register('preacher')} />
              </div>
            </div>
          )}

          {eventType === 'special' && (
            <div className="space-y-1.5">
              <Label htmlFor="e_special">Categoría del evento</Label>
              <Input id="e_special" placeholder="Ej: Aniversario, Vigilia" {...register('special_category')} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="e_desc">Descripción</Label>
            <Textarea id="e_desc" rows={3} {...register('description')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="e_obs">Observaciones</Label>
            <Textarea id="e_obs" rows={2} {...register('observations')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {event ? 'Guardar cambios' : 'Crear evento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
