create table if not exists obs_media (
  id serial primary key,
  type varchar not null,
  gif_url text,
  sound_url text,
  text text
);

create index if not exists obs_media_type_idx on obs_media(type);

alter table event_logs add column if not exists type varchar;
