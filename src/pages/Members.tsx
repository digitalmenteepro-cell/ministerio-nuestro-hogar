import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MoreVertical, Plus, Search, UserCheck, UserX, Users } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SkeletonTable } from '@/components/ui/skeleton';
import { useAsync } from '@/hooks/useAsync';
import { useToast } from '@/hooks/useToast';
import { listInstruments } from '@/services/instruments.service';
import { createUser, deleteUser, listProfiles, updateProfile } from '@/services/profiles.service';
import { errorMessage, fullName, initials } from '@/lib/utils';
import type { Profile, Role } from '@/types';

const NONE = '__none__';

const createSchema = z.object({
  first_name: z.string().min(1, 'Requerido.'),
  last_name: z.string().min(1, 'Requerido.'),
  email: z.string().email('Correo inválido.'),
  password: z.string().min(8, 'Mínimo 8 caracteres.'),
  phone: z.string().optional(),
  role: z.enum(['admin', 'musician']),
  instrument_id: z.string().optional(),
});

type CreateValues = z.infer<typeof createSchema>;

export function Members() {
  const toast = useToast();
  const members = useAsync(() => listProfiles(true), []);
  const instruments = useAsync(() => listInstruments(), []);

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Profile | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: 'musician', instrument_id: NONE },
  });

  const filtered = (members.data ?? []).filter((m) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return fullName(m).toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  });

  const onCreate = async (values: CreateValues) => {
    try {
      await createUser({
        email: values.email,
        password: values.password,
        first_name: values.first_name,
        last_name: values.last_name,
        role: values.role,
        phone: values.phone,
        instrument_id: values.instrument_id === NONE ? null : values.instrument_id,
      });
      toast.success('Integrante creado', `${values.first_name} ya puede iniciar sesión.`);
      setCreateOpen(false);
      reset({ role: 'musician', instrument_id: NONE });
      members.reload();
    } catch (err) {
      toast.error('No se pudo crear el integrante', errorMessage(err));
    }
  };

  const changeRole = async (m: Profile, role: Role) => {
    try {
      await updateProfile(m.id, { role });
      toast.success('Rol actualizado', `${fullName(m)} ahora es ${role === 'admin' ? 'administrador' : 'músico'}.`);
      members.reload();
    } catch (err) {
      toast.error('No se pudo cambiar el rol', errorMessage(err));
    } finally {
      setMenuFor(null);
    }
  };

  const toggleActive = async (m: Profile) => {
    try {
      await updateProfile(m.id, { active: !m.active });
      toast.success(m.active ? 'Integrante desactivado' : 'Integrante reactivado');
      members.reload();
    } catch (err) {
      toast.error('No se pudo actualizar', errorMessage(err));
    } finally {
      setMenuFor(null);
    }
  };

  const changeInstrument = async (m: Profile, value: string) => {
    try {
      await updateProfile(m.id, { instrument_id: value === NONE ? null : value });
      members.reload();
    } catch (err) {
      toast.error('No se pudo asignar el instrumento', errorMessage(err));
    }
  };

  return (
    <PageHeader
      title="Integrantes"
      description="Crea cuentas, asigna roles e instrumentos y controla el acceso."
      action={
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuevo integrante
        </Button>
      }
    >
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
        <Input
          className="pl-9"
          placeholder="Buscar por nombre o correo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {members.loading && <SkeletonTable rows={5} />}
      {members.error && <ErrorState message={members.error} onRetry={members.reload} />}

      {members.data && filtered.length === 0 && (
        <EmptyState
          icon={Users}
          title={search ? 'Sin resultados' : 'Aún no hay integrantes'}
          description={
            search
              ? 'Ningún integrante coincide con tu búsqueda.'
              : 'Crea la primera cuenta del ministerio con el botón “Nuevo integrante”.'
          }
        />
      )}

      <div className="space-y-2">
        {filtered.map((m) => (
          <Card key={m.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-brand/25 text-xs font-bold text-brand-200">
                {m.avatar_url ? <img src={m.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(m)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{fullName(m)}</p>
                  <Badge variant={m.role === 'admin' ? 'default' : 'secondary'}>
                    {m.role === 'admin' ? 'Administrador' : 'Músico'}
                  </Badge>
                  {!m.active && <Badge variant="destructive">Desactivado</Badge>}
                </div>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>

              <div className="w-full sm:w-44">
                <Select
                  value={m.instrument_id ?? NONE}
                  onValueChange={(v) => void changeInstrument(m, v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Instrumento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin instrumento</SelectItem>
                    {(instruments.data ?? []).filter((i) => i.active).map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="relative shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Acciones para ${fullName(m)}`}
                  onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>

                {menuFor === m.id && (
                  <>
                    <button
                      type="button"
                      aria-label="Cerrar"
                      className="fixed inset-0 z-40 cursor-default"
                      onClick={() => setMenuFor(null)}
                    />
                    <div className="absolute right-0 top-11 z-50 w-56 rounded-lg border border-border bg-card p-1 shadow-xl">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => void changeRole(m, m.role === 'admin' ? 'musician' : 'admin')}
                      >
                        <UserCheck className="h-4 w-4" />
                        {m.role === 'admin' ? 'Convertir en músico' : 'Convertir en administrador'}
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => void toggleActive(m)}
                      >
                        <UserX className="h-4 w-4" />
                        {m.active ? 'Desactivar' : 'Reactivar'}
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-400 hover:bg-red-950"
                        onClick={() => {
                          setToDelete(m);
                          setMenuFor(null);
                        }}
                      >
                        <UserX className="h-4 w-4" />
                        Eliminar definitivamente
                      </button>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create user — routed through the admin-users Edge Function. */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo integrante</DialogTitle>
            <DialogDescription>
              La cuenta se crea de forma segura en el servidor. Comparte la contraseña temporal con la persona.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onCreate)} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="c_first">Nombre</Label>
                <Input id="c_first" {...register('first_name')} />
                {errors.first_name && <p className="text-xs text-red-400">{errors.first_name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c_last">Apellido</Label>
                <Input id="c_last" {...register('last_name')} />
                {errors.last_name && <p className="text-xs text-red-400">{errors.last_name.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="c_email">Correo</Label>
              <Input id="c_email" type="email" {...register('email')} />
              {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="c_password">Contraseña temporal</Label>
              <Input id="c_password" type="text" {...register('password')} />
              {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Rol</Label>
                <Select value={watch('role')} onValueChange={(v) => setValue('role', v as Role)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="musician">Músico</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Instrumento</Label>
                <Select value={watch('instrument_id') ?? NONE} onValueChange={(v) => setValue('instrument_id', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin instrumento</SelectItem>
                    {(instruments.data ?? []).filter((i) => i.active).map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="c_phone">Teléfono (opcional)</Label>
              <Input id="c_phone" type="tel" {...register('phone')} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={isSubmitting}>
                Crear integrante
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title={`¿Eliminar a ${toDelete ? fullName(toDelete) : ''}?`}
        description="Se eliminará la cuenta y su historial de asistencia. Esta acción no se puede deshacer. Si solo quieres bloquear el acceso, usa “Desactivar”."
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await deleteUser(toDelete.id);
            toast.success('Integrante eliminado');
            members.reload();
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
