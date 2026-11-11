-- ═══════════════════════════════════════════════════════════════════════
--  GÜNCELLEME 1 — Kira portföyü gizliliği
--  Kiracılar, mülkler, kira ödemeleri ve mülk giderleri yalnızca
--  yönetici ile "Kiracılar" veya "Mülkler & Kiralar" sayfası açılmış
--  kişilerce görülebilir. İnşaat ortakları bu verilere sunucuda da erişemez.
--
--  Supabase → SQL Editor → New query → bu dosyanın tamamını yapıştır → Run
--  Tekrar çalıştırmak güvenlidir.
-- ═══════════════════════════════════════════════════════════════════════

-- Bu kayıt kira portföyüne mi ait?
create or replace function public.is_rental_record(col text, d jsonb)
returns boolean language sql immutable
as $$
  select col in ('properties', 'units', 'tenants', 'leases', 'rentPayments')
      or (col = 'transactions' and coalesce(d ->> 'propertyId', '') <> '')
$$;

-- Giriş yapan kişi kira portföyünü görebilir mi?
create or replace function public.can_see_rentals()
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce((
    select role = 'yonetici' or pages && array['kiracilar', 'mulkler']::text[]
      from public.profiles
     where id = auth.uid() and active
  ), false)
$$;

grant execute on function public.is_rental_record(text, jsonb), public.can_see_rentals() to authenticated;

drop policy if exists records_read   on public.records;
drop policy if exists records_insert on public.records;
drop policy if exists records_update on public.records;
drop policy if exists records_delete on public.records;

create policy records_read on public.records for select to authenticated
  using (public.is_member() and (not public.is_rental_record(collection, data) or public.can_see_rentals()));

create policy records_insert on public.records for insert to authenticated
  with check (public.can_add() and (not public.is_rental_record(collection, data) or public.can_see_rentals()));

create policy records_update on public.records for update to authenticated
  using (public.can_edit() and (not public.is_rental_record(collection, data) or public.can_see_rentals()))
  with check (public.can_edit() and (not public.is_rental_record(collection, data) or public.can_see_rentals()));

create policy records_delete on public.records for delete to authenticated
  using (public.can_edit() and (not public.is_rental_record(collection, data) or public.can_see_rentals()));
