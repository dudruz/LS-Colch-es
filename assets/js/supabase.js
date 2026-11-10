// Cliente único do Supabase para site e painel
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

// Caminho salvo no banco → URL pública da foto/vídeo
export function urlMidia(caminho, bucket = 'produtos') {
  if (!caminho) return null;
  if (/^https?:\/\//.test(caminho)) return caminho;
  return supabase.storage.from(bucket).getPublicUrl(caminho).data.publicUrl;
}
