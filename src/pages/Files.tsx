import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Download, Eye, FileAudio, FileImage, FileText, FileType, Music, Trash2, Upload,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SkeletonTable } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import {
  deleteFile, downloadFile, getSignedUrl, listFiles, MAX_FILE_BYTES, uploadFile, validateFile,
} from '@/services/storage.service';
import { errorMessage, formatBytes, fullName } from '@/lib/utils';
import type { FileCategory, MinistryFile } from '@/types';

const ICONS: Record<FileCategory, typeof FileText> = {
  pdf: FileText,
  word: FileType,
  image: FileImage,
  audio: FileAudio,
  score: Music,
  other: FileText,
};

const CATEGORY_LABEL: Record<FileCategory, string> = {
  pdf: 'PDF',
  word: 'Word',
  image: 'Imagen',
  audio: 'Audio',
  score: 'Partitura',
  other: 'Otro',
};

const TABS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'pdf', label: 'PDF' },
  { value: 'word', label: 'Word' },
  { value: 'image', label: 'Imágenes' },
  { value: 'audio', label: 'Audio' },
  { value: 'score', label: 'Partituras' },
];

export function Files() {
  const { profile, isAdmin } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('all');
  const files = useAsync(() => listFiles(tab === 'all' ? undefined : (tab as FileCategory)), [tab]);

  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<MinistryFile | null>(null);

  const handleUpload = async (file: File) => {
    if (!profile) return;

    const check = validateFile(file);
    if (!check.ok) {
      toast.error('Archivo no válido', check.error);
      return;
    }

    setProgress(0);
    try {
      await uploadFile({ file, ownerId: profile.id, onProgress: setProgress });
      toast.success('Archivo subido', file.name);
      files.reload();
    } catch (err) {
      toast.error('No se pudo subir el archivo', errorMessage(err));
    } finally {
      setProgress(null);
    }
  };

  const handleView = async (f: MinistryFile) => {
    try {
      const url = await getSignedUrl(f.path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error('No se pudo abrir el archivo', errorMessage(err));
    }
  };

  const handleDownload = async (f: MinistryFile) => {
    try {
      await downloadFile(f.path, f.name);
    } catch (err) {
      toast.error('No se pudo descargar', errorMessage(err));
    }
  };

  return (
    <PageHeader
      title="Archivos"
      description="PDF, Word, imágenes, audio y partituras del ministerio."
      action={
        <Button loading={progress !== null} onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4" />
          Subir archivo
        </Button>
      }
    >
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.mp3,.wav,.m4a,.ogg"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleUpload(file);
          e.target.value = '';
        }}
      />

      {progress !== null && (
        <Card className="mb-4">
          <CardContent className="pt-5">
            <div className="mb-2 flex justify-between text-sm">
              <span>Subiendo archivo…</span>
              <span className="text-muted-foreground">{progress}%</span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-zinc-800"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full bg-brand transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList className="flex w-full flex-wrap justify-start">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {files.loading && <SkeletonTable rows={4} />}
      {files.error && <ErrorState message={files.error} onRetry={files.reload} />}

      {files.data?.length === 0 && (
        <EmptyState
          icon={Upload}
          title="No hay archivos"
          description={`Sube el primer archivo. Máximo ${formatBytes(MAX_FILE_BYTES)} por archivo.`}
          action={
            <Button onClick={() => inputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Subir archivo
            </Button>
          }
        />
      )}

      <div className="space-y-2">
        {(files.data ?? []).map((f) => {
          const Icon = ICONS[f.category] ?? FileText;
          const canDelete = isAdmin || f.owner_id === profile?.id;

          return (
            <Card key={f.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <Icon className="h-5 w-5 shrink-0 text-brand-300" aria-hidden />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{f.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatBytes(f.size_bytes)} · {fullName(f.owner)} ·{' '}
                    {format(new Date(f.created_at), "d MMM yyyy", { locale: es })}
                  </p>
                  <code className="mt-1 block truncate rounded bg-zinc-950 px-1.5 py-0.5 text-[10px] text-zinc-500">
                    {f.path}
                  </code>
                </div>

                <Badge variant="secondary">{CATEGORY_LABEL[f.category] ?? 'Otro'}</Badge>

                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" aria-label="Ver" onClick={() => void handleView(f)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Descargar" onClick={() => void handleDownload(f)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  {canDelete && (
                    <Button variant="ghost" size="icon" aria-label="Eliminar" onClick={() => setToDelete(f)}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title={`¿Eliminar “${toDelete?.name}”?`}
        description="El archivo se borrará permanentemente del almacenamiento. Esta acción no se puede deshacer."
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await deleteFile(toDelete.id, toDelete.path);
            toast.success('Archivo eliminado');
            files.reload();
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
