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
  theme text default 'system',
  total_streams_watched integer default 0,
  total_subs_gifted integer default 0,
  total_subs_received integer default 0,
  total_chat_messages_sent integer default 0,
  total_times_tagged integer default 0,
  total_commands_run integer default 0,
  total_months_subbed integer default 0,
  total_watch_time integer default 0,
  clips_created integer default 0,
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
  poceluy_tag_match_success_100 integer default 0,
  combo_commands integer default 0
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
  add column if not exists total_watch_time integer default 0,
  add column if not exists clips_created integer default 0,
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
  add column if not exists poceluy_tag_match_success_100 integer default 0,
  add column if not exists combo_commands integer default 0;

create table if not exists stream_chatters (
  user_id integer primary key references users(id),
  message_count integer default 0
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
  title text,
  type varchar,
  created_at timestamp default now()
);

create table if not exists obs_media (
  id serial primary key,
  type varchar not null,
  gif_url text,
  sound_url text,
  text text
);

create index if not exists obs_media_type_idx on obs_media(type);

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

create table if not exists achievements (
  id serial primary key,
  stat_key text,
  title text,
  description text,
  threshold integer
);

create table if not exists user_achievements (
  user_id integer references users(id),
  achievement_id integer references achievements(id),
  earned_at timestamp,
  primary key (user_id, achievement_id)
);

create table if not exists user_medals (
  user_id integer references users(id),
  stat_key text,
  medal_type text,
  awarded_at timestamp,
  primary key (user_id, stat_key, medal_type)
);


insert into achievements (stat_key, title, description, threshold) values
  ('total_watch_time', 'Добросовестный зритель I', 'Просмотр 1 часа трансляций', 60),
  ('total_watch_time', 'Добросовестный зритель II', 'Просмотр 2 часов трансляций', 120),
  ('total_watch_time', 'Добросовестный зритель III', 'Просмотр 4 часов трансляций', 240),
  ('total_watch_time', 'Марафонец I', 'Просмотр 10 часов трансляций', 600),
  ('total_watch_time', 'Марафонец II', 'Просмотр 30 часов трансляций', 1800),
  ('total_watch_time', 'Марафонец III', 'Просмотр 50 часов трансляций', 3000)
on conflict do nothing;

insert into achievements (stat_key, title, description, threshold) values
  ('message_count', 'Болтун I', 'Отправлено 20 сообщений за стрим', 20),
  ('message_count', 'Болтун II', 'Отправлено 50 сообщений за стрим', 50),
  ('message_count', 'Болтун III', 'Отправлено 100 сообщений за стрим', 100),
  ('total_chat_messages_sent', 'Завсегдатая I', 'Отправлено 500 сообщений в чате', 500),
  ('total_chat_messages_sent', 'Завсегдатая II', 'Отправлено 1000 сообщений в чате', 1000),
  ('total_chat_messages_sent', 'Завсегдатая III', 'Отправлено 2000 сообщений в чате', 2000)
on conflict do nothing;

insert into achievements (stat_key, title, description, threshold) values
  ('clips_created', 'Клипмейкер', 'Создан первый клип', 1)
on conflict do nothing;

insert into achievements (stat_key, title, description, threshold) values
  ('combo_commands', 'Комбо-режим', 'Выполнить !интим и !поцелуй в течение 60 секунд', 1)
on conflict do nothing;

insert into achievements (stat_key, title, description, threshold) values
  ('first_message', 'First Blood', 'Отправлено первое сообщение в чате', 1)
on conflict do nothing;



alter table users
  add column if not exists theme text default 'system';
