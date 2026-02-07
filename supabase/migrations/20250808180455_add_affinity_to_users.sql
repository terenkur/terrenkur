alter table users
  add column if not exists affinity integer default 0,
  add column if not exists last_affinity_note text;

update users
  set affinity = 0
  where affinity is null;
