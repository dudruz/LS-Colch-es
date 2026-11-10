-- =====================================================================
-- LS Colchões · Banco v2 · 04 · Arquivos (fotos e vídeos)
--   produtos → fotos/vídeos dos produtos   (leitura pública)
--   site     → banners e mídias do site    (leitura pública)
-- Só admin/gerente envia, troca ou apaga.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('produtos', 'produtos', true, 10485760, array['image/jpeg','image/png','image/webp','video/mp4']),
  ('site',     'site',     true, 52428800, array['image/jpeg','image/png','image/webp','video/mp4'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy ls_midias_equipe_le on storage.objects
  for select to authenticated using (bucket_id in ('produtos','site') and public.eh_equipe());

create policy ls_midias_admin_envia on storage.objects
  for insert to authenticated with check (bucket_id in ('produtos','site') and public.eh_admin());

create policy ls_midias_admin_troca on storage.objects
  for update to authenticated using (bucket_id in ('produtos','site') and public.eh_admin())
  with check (bucket_id in ('produtos','site') and public.eh_admin());

create policy ls_midias_admin_apaga on storage.objects
  for delete to authenticated using (bucket_id in ('produtos','site') and public.eh_admin());
