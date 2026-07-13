import { useState } from 'react';
import { Guitar, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SkeletonTable } from '@/components/ui/skeleton';
import { useAsync } from '@/hooks/useAsync';
import { useToast } from '@/hooks/useToast';
import {
  createInstrument, deleteInstrument, listInstruments, updateInstrument,
} from '@/services/instruments.service';
import { errorMessage } from '@/lib/utils';
import type { Instrument } from '@/types';

export function Instruments() {
  const toast = useToast();
  const instruments = useAsync(() => listInstruments(), []);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Instrument | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Instrument | null>(null);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDialogOpen(true);
  };

  const openEdit = (i: Instrument) => {
    setEditing(i);
    setName(i.name);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateInstrument(editing.id, { name: name.trim() });
        toast.success('Instrumento actualizado');
      } else {
        await createInstrument(name.trim());
        toast.success('Instrumento creado');
      }
      setDialogOpen(false);
      instruments.reload();
    } catch (err) {
      toast.error('No se pudo guardar', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (i: Instrument) => {
    try {
      await updateInstrument(i.id, { active: !i.active });
      instruments.reload();
    } catch (err) {
      toast.error('No se pudo actualizar', errorMessage(err));
    }
  };

  return (
    <PageHeader
      title="Instrumentos"
      description="Administra los instrumentos que puedes asignar a los integrantes."
      action={
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo instrumento
        </Button>
      }
    >
      {instruments.loading && <SkeletonTable rows={4} />}
      {instruments.error && <ErrorState message={instruments.error} onRetry={instruments.reload} />}

      {instruments.data?.length === 0 && (
        <EmptyState
          icon={Guitar}
          title="Aún no hay instrumentos"
          description="Crea el primer instrumento para poder asignarlo a los integrantes."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nuevo instrumento
            </Button>
          }
        />
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(instruments.data ?? []).map((i) => (
          <Card key={i.id}>
            <CardContent className="flex items-center gap-3 p-4">
              <Guitar className="h-5 w-5 shrink-0 text-brand-300" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{i.name}</p>
                {!i.active && <Badge variant="secondary">Inactivo</Badge>}
              </div>
              <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => openEdit(i)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={i.active ? 'Desactivar' : 'Activar'}
                onClick={() => void toggle(i)}
              >
                <span className="text-xs">{i.active ? 'On' : 'Off'}</span>
              </Button>
              <Button variant="ghost" size="icon" aria-label="Eliminar" onClick={() => setToDelete(i)}>
                <Trash2 className="h-4 w-4 text-red-400" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar instrumento' : 'Nuevo instrumento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="inst_name">Nombre</Label>
            <Input
              id="inst_name"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void save()}
              placeholder="Ej: Guitarra eléctrica"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={() => void save()}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title={`¿Eliminar “${toDelete?.name}”?`}
        description="Los integrantes que lo tengan asignado quedarán sin instrumento. Si prefieres conservarlo, desactívalo."
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await deleteInstrument(toDelete.id);
            toast.success('Instrumento eliminado');
            instruments.reload();
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
