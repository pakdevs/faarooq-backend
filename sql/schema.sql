-- Supabase schema for Twitter-like MVP (idempotent)
-- Safe to run multiple times; objects are created only if missing.

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- USERS
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique check (char_length(handle) between 3 and 30),
  display_name text,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- NOTE: When using Supabase Auth, set public.users.id = auth.users.id for each account.
-- We cannot declare a hard FK to auth.users in public schema, but code ensures IDs match.

-- FOLLOWS
create table if not exists public.follows (
  follower_id uuid not null references public.users(id) on delete cascade,
  followee_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id)
);

-- POSTS
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 280),
  reply_to_post_id uuid null references public.posts(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Soft delete support
alter table public.posts add column if not exists deleted_at timestamptz null;

-- MEDIA (optional for MVP)
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  url text not null,
  media_type text not null check (media_type in ('image','video','gif')) default 'image'
);

-- LIKES
create table if not exists public.likes (
  user_id uuid not null references public.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- REPOSTS
create table if not exists public.reposts (
  user_id uuid not null references public.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- NOTIFICATIONS (likes/replies basic)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,      -- recipient
  kind text not null check (kind in ('like','reply','follow')),
  actor_id uuid null references public.users(id) on delete set null,        -- who did it
  post_id uuid null references public.posts(id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz null
);

-- Indexes for feeds/cursors
create index if not exists posts_created_at_id_idx on public.posts (created_at desc, id desc);
create index if not exists posts_deleted_created_idx on public.posts (deleted_at nulls first, created_at desc);
create index if not exists follows_follower_followee_idx on public.follows (follower_id, followee_id);
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists likes_post_created_idx on public.likes (post_id, created_at desc);
create index if not exists reposts_post_created_idx on public.reposts (post_id, created_at desc);
create index if not exists posts_reply_to_idx on public.posts (reply_to_post_id, created_at desc);

-- RLS (enable)
alter table public.users enable row level security;
alter table public.follows enable row level security;
alter table public.posts enable row level security;
alter table public.media enable row level security;
alter table public.likes enable row level security;
alter table public.reposts enable row level security;
alter table public.notifications enable row level security;

-- Users: read-all; update own (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and policyname = 'users_read_all'
  ) then
    create policy users_read_all on public.users for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and policyname = 'users_insert_own'
  ) then
    create policy users_insert_own on public.users for insert with check (auth.uid() = id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and policyname = 'users_update_own'
  ) then
    create policy users_update_own on public.users for update using (auth.uid() = id) with check (auth.uid() = id);
  end if;
end $$;

-- Posts: read-all; write own (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'posts' and policyname = 'posts_read_all'
  ) then
    create policy posts_read_all on public.posts for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'posts' and policyname = 'posts_insert_own'
  ) then
    create policy posts_insert_own on public.posts for insert with check (auth.uid() = author_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'posts' and policyname = 'posts_update_own'
  ) then
    create policy posts_update_own on public.posts for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'posts' and policyname = 'posts_delete_own'
  ) then
    create policy posts_delete_own on public.posts for delete using (auth.uid() = author_id);
  end if;
end $$;

-- Follows: select own relationships; follow/unfollow as self (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'follows' and policyname = 'follows_select_own'
  ) then
    create policy follows_select_own on public.follows for select using (follower_id = auth.uid() or followee_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'follows' and policyname = 'follows_insert_own'
  ) then
    create policy follows_insert_own on public.follows for insert with check (follower_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'follows' and policyname = 'follows_delete_own'
  ) then
    create policy follows_delete_own on public.follows for delete using (follower_id = auth.uid());
  end if;
end $$;

-- Likes/Reposts: read-all; write own (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'likes' and policyname = 'likes_read_all'
  ) then
    create policy likes_read_all on public.likes for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'likes' and policyname = 'likes_write_own'
  ) then
    create policy likes_write_own on public.likes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'reposts' and policyname = 'reposts_read_all'
  ) then
    create policy reposts_read_all on public.reposts for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'reposts' and policyname = 'reposts_write_own'
  ) then
    create policy reposts_write_own on public.reposts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- Media: read-all; insert allowed for authenticated (simplify for MVP) (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'media' and policyname = 'media_read_all'
  ) then
    create policy media_read_all on public.media for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'media' and policyname = 'media_insert_auth'
  ) then
    create policy media_insert_auth on public.media for insert with check (auth.role() = 'authenticated');
  end if;
end $$;

-- Notifications: recipient-only read/update (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'notif_read_own'
  ) then
    create policy notif_read_own on public.notifications for select using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'notif_insert_actor'
  ) then
    create policy notif_insert_actor on public.notifications for insert with check (actor_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'notif_update_own'
  ) then
    create policy notif_update_own on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;
