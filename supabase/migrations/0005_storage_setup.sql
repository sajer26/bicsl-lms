-- ============================================================================
-- BICSL LMS — Storage bucket for module resources (PDF/poster/image/file)
-- ============================================================================
-- Videos are NOT stored here — they live on YouTube (Unlisted) and only the
-- external ID is stored in `module_resources.video_external_id`. This bucket
-- is for the small files: PDFs, posters, images, misc downloadable files.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('module-resources', 'module-resources', true)
on conflict (id) do nothing;

-- Public read (files are training material, not sensitive — matches the
-- "PDF opens inline / images display directly" requirement without needing
-- signed URLs for every view). Write access is Super Admin only.

create policy "public can read module-resources"
  on storage.objects for select
  using (bucket_id = 'module-resources');

create policy "super_admin can upload module-resources"
  on storage.objects for insert
  with check (bucket_id = 'module-resources' and public.is_super_admin());

create policy "super_admin can update module-resources"
  on storage.objects for update
  using (bucket_id = 'module-resources' and public.is_super_admin());

create policy "super_admin can delete module-resources"
  on storage.objects for delete
  using (bucket_id = 'module-resources' and public.is_super_admin());
