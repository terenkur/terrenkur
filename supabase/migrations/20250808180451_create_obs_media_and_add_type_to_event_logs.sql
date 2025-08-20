create table if not exists obs_media (
  id serial primary key,
  type varchar not null check (type in ('intim','poceluy')),
  gif_url text,
  sound_url text,
  text text
);

alter table event_logs add column if not exists type varchar;
