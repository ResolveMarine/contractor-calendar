-- ============================================================
-- Migration 002: Capability file storage
-- Run AFTER 001_initial_schema.sql
-- ============================================================

-- Create storage bucket for capability statements
insert into storage.buckets (id, name, public)
values ('capabilities', 'capabilities', true)
on conflict (id) do nothing;

-- Anyone authenticated can read/download
create policy "Authenticated read capability files"
  on storage.objects for select
  using (bucket_id = 'capabilities' and auth.uid() is not null);

-- Only admins can upload
create policy "Admins upload capability files"
  on storage.objects for insert
  with check (
    bucket_id = 'capabilities'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- Only admins can update
create policy "Admins update capability files"
  on storage.objects for update
  using (
    bucket_id = 'capabilities'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- Only admins can delete
create policy "Admins delete capability files"
  on storage.objects for delete
  using (
    bucket_id = 'capabilities'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );
