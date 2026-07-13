import { requireSupabase } from '@/lib/supabase';

export interface SearchResult {
  kind: 'song' | 'event' | 'member' | 'file' | 'announcement';
  id: string;
  title: string;
  subtitle: string | null;
  url: string;
}

/** Global search across songs, events, members, files and announcements. */
export async function globalSearch(term: string): Promise<SearchResult[]> {
  const q = term.trim();
  if (q.length < 2) return [];

  const db = requireSupabase();
  const like = `%${q}%`;

  const [songs, events, members, files, announcements] = await Promise.all([
    db.from('songs').select('id,title,author').or(`title.ilike.${like},author.ilike.${like}`).limit(5),
    db.from('events').select('id,title,event_type,starts_at').ilike('title', like).limit(5),
    db.from('profiles').select('id,first_name,last_name,email').or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`).limit(5),
    db.from('files').select('id,name,category').ilike('name', like).limit(5),
    db.from('announcements').select('id,title').ilike('title', like).limit(5),
  ]);

  const results: SearchResult[] = [];

  for (const s of songs.data ?? []) {
    results.push({ kind: 'song', id: s.id, title: s.title, subtitle: s.author, url: `/repertorio?song=${s.id}` });
  }
  for (const e of events.data ?? []) {
    results.push({
      kind: 'event',
      id: e.id,
      title: e.title,
      subtitle: new Date(e.starts_at).toLocaleString('es-CL'),
      url: `/calendario?event=${e.id}`,
    });
  }
  for (const m of members.data ?? []) {
    results.push({
      kind: 'member',
      id: m.id,
      title: `${m.first_name} ${m.last_name}`.trim(),
      subtitle: m.email,
      url: `/integrantes?user=${m.id}`,
    });
  }
  for (const f of files.data ?? []) {
    results.push({ kind: 'file', id: f.id, title: f.name, subtitle: f.category, url: '/archivos' });
  }
  for (const a of announcements.data ?? []) {
    results.push({ kind: 'announcement', id: a.id, title: a.title, subtitle: null, url: '/anuncios' });
  }

  return results;
}
