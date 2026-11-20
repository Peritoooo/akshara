-- Akshara — multi-user schema (metadata sync only; PDF files stay on device)
-- Run this once in the Supabase SQL editor of a fresh project.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles: one row per auth user, created automatically on sign-up.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Reader',
  daily_goal integer not null default 30 check (daily_goal between 5 and 180),
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Books: metadata only. The PDF itself lives in the reader's IndexedDB.
-- deleted_at is a tombstone so removals sync instead of reappearing.
-- ---------------------------------------------------------------------------
create table if not exists public.books (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  author text not null default '',
  description text not null default '',
  genres text[] not null default '{}',
  year integer,
  pages integer not null default 0,
  language text not null default '',
  format text not null check (format in ('pdf', 'epub')),
  file text not null default '',
  publisher text not null default '',
  cover jsonb,
  motif text,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table if not exists public.library_entries (
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id text not null,
  status text not null default 'want' check (status in ('reading', 'want', 'finished')),
  progress real not null default 0 check (progress between 0 and 1),
  favorite boolean not null default false,
  added_at timestamptz not null default now(),
  last_opened_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, book_id)
);

create table if not exists public.reading_positions (
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id text not null,
  percent real not null default 0 check (percent between 0 and 1),
  location text,
  page integer,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, book_id)
);

create table if not exists public.highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id text not null,
  cfi_range text not null,
  text text not null,
  note text,
  color text not null check (color in ('gold', 'sage', 'rose', 'sky')),
  chapter text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id text not null,
  location text,
  page integer,
  label text not null default '',
  percent real not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.collection_books (
  user_id uuid not null references auth.users (id) on delete cascade,
  collection_id uuid not null,
  book_id text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, collection_id, book_id)
);

create table if not exists public.reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id text not null,
  started_at timestamptz not null default now(),
  minutes real not null default 0 check (minutes >= 0),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Indexes for the pull queries the app runs on sign-in.
-- ---------------------------------------------------------------------------
create index if not exists books_user_updated_idx on public.books (user_id, updated_at desc);
create index if not exists entries_user_updated_idx on public.library_entries (user_id, updated_at desc);
create index if not exists positions_user_idx on public.reading_positions (user_id);
create index if not exists highlights_user_book_idx on public.highlights (user_id, book_id);
create index if not exists highlights_user_updated_idx on public.highlights (user_id, updated_at desc);
create index if not exists bookmarks_user_book_idx on public.bookmarks (user_id, book_id);
create index if not exists collections_user_idx on public.collections (user_id);
create index if not exists collection_books_user_idx on public.collection_books (user_id, collection_id);
create index if not exists sessions_user_started_idx on public.reading_sessions (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'books', 'library_entries', 'reading_positions',
    'highlights', 'bookmarks', 'collections'
  ] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format(
      'create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()',
      t, t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Create a profile automatically whenever someone signs up.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Reader')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row-level security: a user can only ever touch their own rows.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.library_entries enable row level security;
alter table public.reading_positions enable row level security;
alter table public.highlights enable row level security;
alter table public.bookmarks enable row level security;
alter table public.collections enable row level security;
alter table public.collection_books enable row level security;
alter table public.reading_sessions enable row level security;

drop policy if exists profiles_own on public.profiles;
create policy profiles_own on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

do $$
declare
  t text;
begin
  foreach t in array array[
    'books', 'library_entries', 'reading_positions', 'highlights',
    'bookmarks', 'collections', 'collection_books', 'reading_sessions'
  ] loop
    execute format('drop policy if exists %I_own on public.%I', t, t);
    execute format(
      'create policy %I_own on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t, t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime (optional): lets a second device see changes without refreshing.
-- Guarded so re-running this migration is safe.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'library_entries', 'reading_positions', 'highlights',
    'bookmarks', 'collections', 'collection_books'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
