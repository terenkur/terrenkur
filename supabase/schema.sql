create table if not exists items (
  id serial primary key,
  name text
);

create table if not exists users (
  id serial primary key,
  username text,
  auth_id uuid references auth.users(id) unique,
  vote_limit integer default 1,
  is_moderator boolean default false,
  total_streams_watched integer default 0,
  total_subs_gifted integer default 0,
  total_subs_received integer default 0,
  total_chat_messages_sent integer default 0,
  total_times_tagged integer default 0,
  total_commands_run integer default 0,
  total_months_subbed integer default 0,
  intim_no_tag_0 integer default 0,
  intim_no_tag_69 integer default 0,
  intim_no_tag_100 integer default 0,
  intim_with_tag_0 integer default 0,
  intim_with_tag_69 integer default 0,
  intim_with_tag_100 integer default 0,
  intim_self_no_tag integer default 0,
  intim_self_no_tag_0 integer default 0,
  intim_self_no_tag_69 integer default 0,
  intim_self_no_tag_100 integer default 0,
  intim_self_with_tag integer default 0,
  intim_self_with_tag_0 integer default 0,
  intim_self_with_tag_69 integer default 0,
  intim_self_with_tag_100 integer default 0,
  intim_tagged_equals_partner integer default 0,
  intim_tagged_equals_partner_0 integer default 0,
  intim_tagged_equals_partner_69 integer default 0,
  intim_tagged_equals_partner_100 integer default 0,
  intim_tag_match_success integer default 0,
  intim_tag_match_success_0 integer default 0,
  intim_tag_match_success_69 integer default 0,
  intim_tag_match_success_100 integer default 0,
  poceluy_no_tag_0 integer default 0,
  poceluy_no_tag_69 integer default 0,
  poceluy_no_tag_100 integer default 0,
  poceluy_with_tag_0 integer default 0,
  poceluy_with_tag_69 integer default 0,
  poceluy_with_tag_100 integer default 0,
  poceluy_self_no_tag integer default 0,
  poceluy_self_no_tag_0 integer default 0,
  poceluy_self_no_tag_69 integer default 0,
  poceluy_self_no_tag_100 integer default 0,
  poceluy_self_with_tag integer default 0,
  poceluy_self_with_tag_0 integer default 0,
  poceluy_self_with_tag_69 integer default 0,
  poceluy_self_with_tag_100 integer default 0,
  poceluy_tagged_equals_partner integer default 0,
  poceluy_tagged_equals_partner_0 integer default 0,
  poceluy_tagged_equals_partner_69 integer default 0,
  poceluy_tagged_equals_partner_100 integer default 0,
  poceluy_tag_match_success integer default 0,
  poceluy_tag_match_success_0 integer default 0,
  poceluy_tag_match_success_69 integer default 0,
  poceluy_tag_match_success_100 integer default 0
);

alter table users
  add column if not exists twitch_login text,
  add column if not exists total_streams_watched integer default 0,
  add column if not exists total_subs_gifted integer default 0,
  add column if not exists total_subs_received integer default 0,
  add column if not exists total_chat_messages_sent integer default 0,
  add column if not exists total_times_tagged integer default 0,
  add column if not exists total_commands_run integer default 0,
  add column if not exists total_months_subbed integer default 0,
  add column if not exists intim_no_tag_0 integer default 0,
  add column if not exists intim_no_tag_69 integer default 0,
  add column if not exists intim_no_tag_100 integer default 0,
  add column if not exists intim_with_tag_0 integer default 0,
  add column if not exists intim_with_tag_69 integer default 0,
  add column if not exists intim_with_tag_100 integer default 0,
  add column if not exists intim_self_no_tag integer default 0,
  add column if not exists intim_self_no_tag_0 integer default 0,
  add column if not exists intim_self_no_tag_69 integer default 0,
  add column if not exists intim_self_no_tag_100 integer default 0,
  add column if not exists intim_self_with_tag integer default 0,
  add column if not exists intim_self_with_tag_0 integer default 0,
  add column if not exists intim_self_with_tag_69 integer default 0,
  add column if not exists intim_self_with_tag_100 integer default 0,
  add column if not exists intim_tagged_equals_partner integer default 0,
  add column if not exists intim_tagged_equals_partner_0 integer default 0,
  add column if not exists intim_tagged_equals_partner_69 integer default 0,
  add column if not exists intim_tagged_equals_partner_100 integer default 0,
  add column if not exists intim_tag_match_success integer default 0,
  add column if not exists intim_tag_match_success_0 integer default 0,
  add column if not exists intim_tag_match_success_69 integer default 0,
  add column if not exists intim_tag_match_success_100 integer default 0,
  add column if not exists poceluy_no_tag_0 integer default 0,
  add column if not exists poceluy_no_tag_69 integer default 0,
  add column if not exists poceluy_no_tag_100 integer default 0,
  add column if not exists poceluy_with_tag_0 integer default 0,
  add column if not exists poceluy_with_tag_69 integer default 0,
  add column if not exists poceluy_with_tag_100 integer default 0,
  add column if not exists poceluy_self_no_tag integer default 0,
  add column if not exists poceluy_self_no_tag_0 integer default 0,
  add column if not exists poceluy_self_no_tag_69 integer default 0,
  add column if not exists poceluy_self_no_tag_100 integer default 0,
  add column if not exists poceluy_self_with_tag integer default 0,
  add column if not exists poceluy_self_with_tag_0 integer default 0,
  add column if not exists poceluy_self_with_tag_69 integer default 0,
  add column if not exists poceluy_self_with_tag_100 integer default 0,
  add column if not exists poceluy_tagged_equals_partner integer default 0,
  add column if not exists poceluy_tagged_equals_partner_0 integer default 0,
  add column if not exists poceluy_tagged_equals_partner_69 integer default 0,
  add column if not exists poceluy_tagged_equals_partner_100 integer default 0,
  add column if not exists poceluy_tag_match_success integer default 0,
  add column if not exists poceluy_tag_match_success_0 integer default 0,
  add column if not exists poceluy_tag_match_success_69 integer default 0,
  add column if not exists poceluy_tag_match_success_100 integer default 0;

create table if not exists stream_chatters (
  user_id integer primary key references users(id)
);

create table if not exists games (
  id serial primary key,
  name text,
  background_image text,
  rawg_id integer unique
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

alter table games
  add column if not exists rawg_id integer unique;

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
  media_url text,
  preview_url text,
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

create table if not exists donationalerts_tokens (
  id serial primary key,
  access_token text,
  refresh_token text,
  expires_at timestamp,
  updated_at timestamp default now(),
);

insert into donationalerts_tokens (access_token, refresh_token, expires_at)
  select null, null, null
  where not exists (select 1 from donationalerts_tokens);

create table if not exists bot_tokens (
  id serial primary key,
  access_token text,
  refresh_token text,
  expires_at timestamp,
  updated_at timestamp default now()
);

insert into bot_tokens (access_token, refresh_token, expires_at)
  select null, null, null
  where not exists (select 1 from bot_tokens);

-- Populate auth_id for existing users based on matching email
update users
set auth_id = u.id
from auth.users u
where users.auth_id is null
  and u.email = users.username;

-- Ensure Twitch logins are stored in lowercase
update users
set twitch_login = lower(twitch_login)
where twitch_login is not null;

-- lowercase twitch_login on insert/update
create or replace function enforce_lowercase_twitch_login()
returns trigger as $$
begin
  if new.twitch_login is not null then
    new.twitch_login := lower(new.twitch_login);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger enforce_lowercase_twitch_login_trigger
before insert or update on users
for each row
execute procedure enforce_lowercase_twitch_login();

create table if not exists playlist_games (
  tag text primary key,
  game_id integer references games(id),
  unique(tag)
);

create table if not exists intim_contexts (
  id serial primary key,
  variant_one text not null,
  variant_two text not null
);

create table if not exists poceluy_contexts (
  id serial primary key,
  variant_two text not null,
  variant_three text not null
);

