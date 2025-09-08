insert into settings(key, value)
  values ('spin_duration', 4)
  on conflict (key) do nothing;
