import { requireSupabase } from '@/lib/supabase';
import type { FileCategory, MinistryFile } from '@/types';

export const BUCKET = 'ministry-files';
export const AVATAR_BUCKET = 'avatars';

/** Must stay in sync with the bucket limits in supabase/storage.sql. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

export const ACCEPTED_MIME: Record<FileCategory, string[]> = {
  pdf: ['application/pdf'],
  word: [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  image: ['image/jpeg', 'image/png', 'image/webp'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg', 'audio/x-m4a'],
  score: ['application/pdf', 'image/jpeg', 'image/png'],
  other: [],
};

const ALL_ACCEPTED = Array.from(
  new Set(Object.values(ACCEPTED_MIME).flat()),
);

export function categoryFromMime(mime: string): FileCategory {
  if (ACCEPTED_MIME.pdf.includes(mime)) return 'pdf';
  if (ACCEPTED_MIME.word.includes(mime)) return 'word';
  if (ACCEPTED_MIME.image.includes(mime)) return 'image';
  if (ACCEPTED_MIME.audio.includes(mime)) return 'audio';
  return 'other';
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/** Client-side guard. The bucket enforces the same rules server-side. */
export function validateFile(file: File, maxBytes = MAX_FILE_BYTES): ValidationResult {
  if (file.size === 0) return { ok: false, error: 'El archivo está vacío.' };
  if (file.size > maxBytes) {
    return { ok: false, error: `El archivo supera el máximo de ${Math.round(maxBytes / 1024 / 1024)} MB.` };
  }
  if (!ALL_ACCEPTED.includes(file.type)) {
    return { ok: false, error: `Tipo de archivo no permitido (${file.type || 'desconocido'}).` };
  }
  return { ok: true };
}

function safeName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function listFiles(category?: FileCategory): Promise<MinistryFile[]> {
  const db = requireSupabase();
  let query = db
    .from('files')
    .select('*, owner:profiles(id,first_name,last_name)')
    .order('created_at', { ascending: false });
  if (category) query = query.eq('category', category);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as MinistryFile[];
}

export interface UploadOptions {
  file: File;
  ownerId: string;
  category?: FileCategory;
  onProgress?: (percent: number) => void;
}

/**
 * Uploads to Storage under `{ownerId}/...` (required by the storage RLS
 * policies) and registers a row in `files`. Rolls back the object if the
 * metadata insert fails, so we never leave orphaned blobs.
 */
export async function uploadFile({ file, ownerId, category, onProgress }: UploadOptions): Promise<MinistryFile> {
  const db = requireSupabase();

  const check = validateFile(file);
  if (!check.ok) throw new Error(check.error);

  const path = `${ownerId}/${Date.now()}-${safeName(file.name)}`;
  onProgress?.(10);

  const { error: uploadError } = await db.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });
  if (uploadError) throw new Error(uploadError.message);
  onProgress?.(75);

  const { data, error } = await db
    .from('files')
    .insert({
      owner_id: ownerId,
      name: file.name,
      path,
      mime_type: file.type,
      size_bytes: file.size,
      category: category ?? categoryFromMime(file.type),
    })
    .select('*, owner:profiles(id,first_name,last_name)')
    .single();

  if (error) {
    await db.storage.from(BUCKET).remove([path]);
    throw new Error(error.message);
  }

  onProgress?.(100);
  return data as MinistryFile;
}

/** Signed URL: the bucket is private, so links expire (default 1 h). */
export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const db = requireSupabase();
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function downloadFile(path: string, filename: string): Promise<void> {
  const db = requireSupabase();
  const { data, error } = await db.storage.from(BUCKET).download(path);
  if (error) throw new Error(error.message);

  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function deleteFile(id: string, path: string): Promise<void> {
  const db = requireSupabase();
  const { error: storageError } = await db.storage.from(BUCKET).remove([path]);
  if (storageError) throw new Error(storageError.message);
  const { error } = await db.from('files').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function uploadAvatar(file: File, userId: string): Promise<string> {
  const db = requireSupabase();
  if (!ACCEPTED_MIME.image.includes(file.type)) {
    throw new Error('La foto debe ser JPG, PNG o WEBP.');
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error('La foto supera el máximo de 5 MB.');
  }
  const path = `${userId}/avatar-${Date.now()}-${safeName(file.name)}`;
  const { error } = await db.storage.from(AVATAR_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(error.message);
  const { data } = db.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
