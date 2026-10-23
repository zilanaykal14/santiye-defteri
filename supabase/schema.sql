-- ═══════════════════════════════════════════════════════════════════════
--  ŞANTİYE DEFTERİ — Supabase kurulum betiği
--  Supabase panelinde: SQL Editor → New query → bu dosyanın tamamını yapıştır → Run
--  Tekrar çalıştırmak güvenlidir (var olanı bozmaz).
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Kullanıcı profilleri (yetkiler burada) ──────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '',
  username    text not null unique,
  role        text not null default 'eleman' check (role in ('yonetici', 'eleman')),
  pages       text[] not null default '{}',
  can_add     boolean not null default false,
  can_edit    boolean not null default false,
  active      boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ── 2. Tüm uygulama kayıtları (projeler, giderler, kiracılar, günlük…) ──
--  Her kayıt tek satır: collection = 'transactions' | 'projects' | ...
create table if not exists public.records (
  collection  text not null,
  id          text not null,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid(),
  primary key (collection, id)
);
create index if not exists records_updated_idx on public.records (updated_at);

-- ── 3. Değişiklik kaydı (kim neyi ne zaman değiştirdi/sildi) ───────────
create table if not exists public.audit_log (
  id          bigserial primary key,
  collection  text not null,
  record_id   text not null,
  action      text not null,
  old_data    jsonb,
  new_data    jsonb,
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);

-- ── 4. Yetki yardımcıları ──────────────────────────────────────────────

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select role = 'yonetici' from public.profiles where id = auth.uid() and active), false) $$;

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and active) $$;

create or replace function public.can_add()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select role = 'yonetici' or can_add from public.profiles where id = auth.uid() and active), false) $$;

create or replace function public.can_edit()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select role = 'yonetici' or can_edit from public.profiles where id = auth.uid() and active), false) $$;

-- ── 5. Yeni kullanıcı → profil (ilk kullanıcı otomatik YÖNETİCİ olur) ──
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  first_user boolean;
begin
  perform pg_advisory_xact_lock(4242);
  select not exists (select 1 from public.profiles) into first_user;
  insert into public.profiles (id, name, username, role, pages, can_add, can_edit, active)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(new.email, '@', 1)),
    case when first_user then 'yonetici' else 'eleman' end,
    '{}',
    first_user, first_user,
    first_user           -- sonraki kayıtlar yönetici açana kadar KAPALI
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Giriş ekranı "ilk kurulum" gösterilsin mi?
create or replace function public.needs_setup()
returns boolean language sql stable security definer set search_path = public
as $$ select not exists (select 1 from public.profiles) $$;

-- Yönetici: başka kullanıcının şifresini belirler
create or replace function public.admin_set_password(target uuid, new_password text)
returns void language plpgsql security definer set search_path = public, extensions
as $$
begin
  if not public.is_admin() then raise exception 'Yetkiniz yok'; end if;
  if length(new_password) < 6 then raise exception 'Şifre en az 6 karakter olmalı'; end if;
  update auth.users
     set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = target;
end $$;

-- Yönetici: kullanıcıyı tamamen siler (girdiği kayıtlar kalır)
create or replace function public.admin_delete_user(target uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Yetkiniz yok'; end if;
  if target = auth.uid() then raise exception 'Kendinizi silemezsiniz'; end if;
  delete from auth.users where id = target;
end $$;

-- Son aktif yönetici kapatılamaz / elemana çevrilemez
create or replace function public.protect_last_admin()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.role = 'yonetici' and old.active and (new.role <> 'yonetici' or not new.active) then
    if (select count(*) from public.profiles where role = 'yonetici' and active and id <> old.id) = 0 then
      raise exception 'Son yönetici kapatılamaz';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_protect_last_admin on public.profiles;
create trigger profiles_protect_last_admin
  before update on public.profiles
  for each row execute function public.protect_last_admin();

-- Değişiklik kaydı tetikleyicisi
create or replace function public.audit_records()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_log (collection, record_id, action, old_data, changed_by)
    values (old.collection, old.id, 'sil', old.data, auth.uid());
    return old;
  elsif tg_op = 'UPDATE' then
    new.updated_at := now();
    new.updated_by := auth.uid();
    if new.data is distinct from old.data then
      insert into public.audit_log (collection, record_id, action, old_data, new_data, changed_by)
      values (new.collection, new.id, 'degistir', old.data, new.data, auth.uid());
    end if;
    return new;
  else
    new.updated_by := coalesce(auth.uid(), new.updated_by);
    return new;
  end if;
end $$;
drop trigger if exists records_audit on public.records;
create trigger records_audit
  before insert or update or delete on public.records
  for each row execute function public.audit_records();

-- ── 6. Satır düzeyinde güvenlik (RLS) ──────────────────────────────────
alter table public.profiles  enable row level security;
alter table public.records   enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists profiles_read   on public.profiles;
drop policy if exists profiles_admin  on public.profiles;
create policy profiles_read  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_admin on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists records_read   on public.records;
drop policy if exists records_insert on public.records;
drop policy if exists records_update on public.records;
drop policy if exists records_delete on public.records;
create policy records_read   on public.records for select to authenticated using (public.is_member());
create policy records_insert on public.records for insert to authenticated with check (public.can_add());
create policy records_update on public.records for update to authenticated using (public.can_edit()) with check (public.can_edit());
create policy records_delete on public.records for delete to authenticated using (public.can_edit());

drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select to authenticated using (public.is_admin());

grant select, insert, update, delete on public.records to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.audit_log to authenticated;
grant usage on schema public to anon, authenticated;
grant execute on function public.needs_setup() to anon, authenticated;
-- Yetki kontrol fonksiyonları RLS içinde çağrılır; "Automatically expose new tables" kapalı olsa da çalışsın
grant execute on function public.is_admin(), public.is_member(), public.can_add(), public.can_edit() to authenticated;
grant execute on function public.admin_set_password(uuid, text) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ── 7. Canlı güncelleme (bir kişi kayıt girince diğerlerinde anında görünsün) ──
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.records;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.profiles;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
