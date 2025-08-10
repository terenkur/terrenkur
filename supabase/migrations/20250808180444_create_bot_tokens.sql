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
