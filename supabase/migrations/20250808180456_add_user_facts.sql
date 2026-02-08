alter table users
  add column if not exists user_facts jsonb default '{}'::jsonb;

update users
set user_facts = '{}'::jsonb
where user_facts is null;
