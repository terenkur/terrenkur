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

alter table users
  add column if not exists twitch_login text;

create table if not exists games (
  id serial primary key,
  name text,
  background_image text
);

alter table games
  add column if not exists status text default 'backlog',
  add column if not exists rating integer,
  add column if not exists selection_method text;

alter table games
  add column if not exists background_image text;

alter table games
  add column if not exists released_year integer,
  add column if not exists genres text[];

create table if not exists polls (
  id serial primary key,
  created_at timestamp default now(),
  archived boolean default false
);

alter table polls
  add column if not exists archived boolean default false;

create table if not exists poll_games (
  poll_id integer references polls(id),
  game_id integer references games(id),
  primary key (poll_id, game_id)
);

create table if not exists game_initiators (
  game_id integer references games(id),
  user_id integer references users(id),
  primary key (game_id, user_id)
);

create table if not exists votes (
  id serial primary key,
  poll_id integer references polls(id),
  game_id integer references games(id),
  user_id integer references users(id),
  slot integer not null
);

create table if not exists poll_results (
  poll_id integer primary key references polls(id),
  winner_id integer references games(id),
  eliminated_order integer[] not null,
  spin_seed text,
  created_at timestamp default now()
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

insert into settings(key, value)
  values ('accept_votes', 1)
  on conflict (key) do nothing;

insert into settings(key, value)
  values ('allow_edit', 1)
  on conflict (key) do nothing;

create table if not exists log_rewards (
  reward_id text primary key
);

create table if not exists event_logs (
  id serial primary key,
  message text not null,
  created_at timestamp default now()
);

create table if not exists twitch_tokens (
  id serial primary key,
  access_token text,
  refresh_token text,
  expires_at timestamp,
  updated_at timestamp default now()
);

insert into twitch_tokens (access_token, refresh_token, expires_at)
  select null, null, null
  where not exists (select 1 from twitch_tokens);

-- Populate auth_id for existing users based on matching email
update users
set auth_id = u.id
from auth.users u
where users.auth_id is null
  and u.email = users.username;
