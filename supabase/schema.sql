create table if not exists items (
  id serial primary key,
  name text
);

create table if not exists users (
  id serial primary key,
  username text,
  auth_id uuid references auth.users(id) unique,
  vote_limit integer default 1,
  is_moderator boolean default false
);

create table if not exists games (
  id serial primary key,
  name text
);

create table if not exists polls (
  id serial primary key,
  created_at timestamp default now()
);

create table if not exists votes (
  id serial primary key,
  poll_id integer references polls(id),
  game_id integer references games(id),
  user_id integer references users(id),
  slot integer not null
);

create index if not exists votes_user_id_idx on votes(user_id);

create index if not exists votes_poll_id_idx on votes(poll_id);
create index if not exists votes_game_id_idx on votes(game_id);

create unique index if not exists votes_user_poll_slot_unique
  on votes(user_id, poll_id, slot);

create table if not exists settings (
  key text primary key,
  value numeric
);

insert into settings(key, value)
  values ('wheel_coeff', 2)
  on conflict (key) do nothing;

insert into settings(key, value)
  values ('zero_vote_weight', 40)
  on conflict (key) do nothing;

-- Populate auth_id for existing users based on matching email
update users
set auth_id = u.id
from auth.users u
where users.auth_id is null
  and u.email = users.username;
