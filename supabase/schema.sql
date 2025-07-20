create table if not exists items (
  id serial primary key,
  name text
);

create table if not exists users (
  id serial primary key,
  username text
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
  user_id integer references users(id)
);

create index if not exists votes_user_id_idx on votes(user_id);

create index if not exists votes_poll_id_idx on votes(poll_id);
create index if not exists votes_game_id_idx on votes(game_id);
