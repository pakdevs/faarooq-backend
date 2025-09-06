-- Idempotent seed for Twitter-like MVP (safe to run multiple times)
-- Run in Supabase SQL Editor or with a service role connection.

-- USERS (upsert by unique handle)
insert into public.users (handle, display_name, bio, avatar_url)
values
  ('alice', 'Alice', 'Hello, I am Alice', null),
  ('bob', 'Bob', 'Builder of things', null),
  ('charlie', 'Charlie', 'I like posts', null)
on conflict (handle) do update set
  display_name = excluded.display_name,
  bio = excluded.bio,
  avatar_url = excluded.avatar_url;

-- FOLLOWS (insert if missing)
insert into public.follows (follower_id, followee_id)
select ua.id, ub.id
from (select id from public.users where handle = 'alice') ua,
     (select id from public.users where handle = 'bob')   ub
where not exists (
  select 1 from public.follows f where f.follower_id = ua.id and f.followee_id = ub.id
);

-- POSTS (ensure unique by author_id + text to avoid duplicates)
-- Alice posts
insert into public.posts (author_id, text)
select u.id, 'Hello world from Alice'
from public.users u
where u.handle = 'alice'
  and not exists (
    select 1 from public.posts p where p.author_id = u.id and p.text = 'Hello world from Alice'
  );

insert into public.posts (author_id, text)
select u.id, 'Another day, another post'
from public.users u
where u.handle = 'alice'
  and not exists (
    select 1 from public.posts p where p.author_id = u.id and p.text = 'Another day, another post'
  );

-- Bob posts
insert into public.posts (author_id, text)
select u.id, 'Bob here, building stuff'
from public.users u
where u.handle = 'bob'
  and not exists (
    select 1 from public.posts p where p.author_id = u.id and p.text = 'Bob here, building stuff'
  );

-- Charlie reply to Alice's first post (optional; if first post exists)
insert into public.posts (author_id, text, reply_to_post_id)
select c.id, 'Nice post, Alice!', a_post.id
from public.users c
join public.users a on a.handle = 'alice'
join public.posts a_post on a_post.author_id = a.id and a_post.text = 'Hello world from Alice'
where c.handle = 'charlie'
  and not exists (
    select 1 from public.posts p where p.author_id = c.id and p.text = 'Nice post, Alice!'
  );

-- LIKES (Charlie likes Alice's first post)
insert into public.likes (user_id, post_id)
select c.id, a_post.id
from public.users c
join public.users a on a.handle = 'alice'
join public.posts a_post on a_post.author_id = a.id and a_post.text = 'Hello world from Alice'
where c.handle = 'charlie'
  and not exists (
    select 1 from public.likes l where l.user_id = c.id and l.post_id = a_post.id
  );

-- REPOSTS (Bob reposts Alice's first post)
insert into public.reposts (user_id, post_id)
select b.id, a_post.id
from public.users b
join public.users a on a.handle = 'alice'
join public.posts a_post on a_post.author_id = a.id and a_post.text = 'Hello world from Alice'
where b.handle = 'bob'
  and not exists (
    select 1 from public.reposts r where r.user_id = b.id and r.post_id = a_post.id
  );

-- NOTIFICATIONS (optional: only if you want to pre-populate; otherwise backend should create them)
-- Create a 'like' notification for Alice when Charlie likes her post
insert into public.notifications (user_id, kind, actor_id, post_id)
select a.id as user_id, 'like' as kind, c.id as actor_id, a_post.id as post_id
from public.users a
join public.users c on c.handle = 'charlie'
join public.posts a_post on a_post.author_id = a.id and a_post.text = 'Hello world from Alice'
where a.handle = 'alice'
  and not exists (
    select 1 from public.notifications n where n.user_id = a.id and n.kind = 'like' and n.actor_id = c.id and n.post_id = a_post.id
  );
