-- ═══════════════════════════════════════════════════════════════════════
--  GÜNCELLEME 2 — Hatırlatıcılar yalnızca yöneticiye
--  "Hatırlatıcılar" kayıtlarını yalnızca yönetici okuyup yazabilir.
--  Kira portföyü kuralı (Güncelleme 1) aynen korunur.
--
--  Supabase → SQL Editor → New query → bu dosyanın tamamını yapıştır → Run
--  Tekrar çalıştırmak güvenlidir.
-- ═══════════════════════════════════════════════════════════════════════

-- Güncelleme 1'deki yardımcılar (çalıştırılmamışsa da kurulur)
create or replace function public.is_rental_record(col text, d jsonb)
returns boolean language sql immutable
as $$
  select col in ('properties', 'units', 'tenants', 'leases', 'rentPayments')
      or (col = 'transactions' and coalesce(d ->> 'propertyId', '') <> '')
$$;

create or replace function public.can_see_rentals()
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce((
    select role = 'yonetici' or pages && array['kiracilar', 'mulkler']::text[]
      from public.profiles
     where id = auth.uid() and active
  ), false)
$$;

-- Giriş yapan kişi bu kayda erişebilir mi? (kira kuralı + yönetici kuralı)
create or replace function public.can_access_record(col text, d jsonb)
returns boolean language sql stable security definer set search_path = public
as $$
  select (not public.is_rental_record(col, d) or public.can_see_rentals())
     and (col <> 'reminders' or public.is_admin())
$$;

grant execute on function public.is_rental_record(text, jsonb), public.can_see_rentals(),
  public.can_access_record(text, jsonb) to authenticated;

drop policy if exists records_read   on public.records;
drop policy if exists records_insert on public.records;
drop policy if exists records_update on public.records;
drop policy if exists records_delete on public.records;

create policy records_read on public.records for select to authenticated
  using (public.is_member() and public.can_access_record(collection, data));

create policy records_insert on public.records for insert to authenticated
  with check (public.can_add() and public.can_access_record(collection, data));

create policy records_update on public.records for update to authenticated
  using (public.can_edit() and public.can_access_record(collection, data))
  with check (public.can_edit() and public.can_access_record(collection, data));

create policy records_delete on public.records for delete to authenticated
  using (public.can_edit() and public.can_access_record(collection, data));
