-- Bring the sync tables in line with the client's data shapes.
-- Safe to run on a fresh database (everything is guarded) and on a database
-- that already applied 20261120090000_init.sql before this change.

-- Collections use client-generated slugs, not UUIDs.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'collections'
      and column_name = 'id'
      and data_type = 'uuid'
  ) then
    alter table public.collections alter column id drop default;
    alter table public.collections alter column id type text using id::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'collection_books'
      and column_name = 'collection_id'
      and data_type = 'uuid'
  ) then
    alter table public.collection_books
      alter column collection_id type text using collection_id::text;
  end if;
end;
$$;

-- Cover thumbnails travel with the book metadata (the PDF does not).
alter table public.books add column if not exists cover_image text;

-- Collection ids are only unique inside one account.
do $$
begin
  if not exists (
    select 1
    from pg_index i
    join pg_class t on t.oid = i.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'collections'
      and i.indisprimary
      and array_length(i.indkey::smallint[], 1) = 2
  ) then
    alter table public.collections drop constraint if exists collections_pkey;
    alter table public.collections add primary key (user_id, id);
  end if;
end;
$$;

-- Membership and session rows need the same change tracking as the rest.
alter table public.collection_books
  add column if not exists updated_at timestamptz not null default now();
alter table public.reading_sessions
  add column if not exists updated_at timestamptz not null default now();

do $$
declare
  t text;
begin
  foreach t in array array['collection_books', 'reading_sessions'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format(
      'create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()',
      t, t
    );
  end loop;
end;
$$;
