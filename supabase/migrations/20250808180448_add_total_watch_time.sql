alter table users
  add column if not exists total_watch_time integer default 0;

insert into achievements (stat_key, title, description, threshold) values
  ('total_watch_time', 'Добросовестный зритель I', 'Просмотр 1 часа трансляций', 60),
  ('total_watch_time', 'Добросовестный зритель II', 'Просмотр 2 часов трансляций', 120),
  ('total_watch_time', 'Добросовестный зритель III', 'Просмотр 4 часов трансляций', 240),
  ('total_watch_time', 'Марафонец I', 'Просмотр 10 часов трансляций', 600),
  ('total_watch_time', 'Марафонец II', 'Просмотр 30 часов трансляций', 1800),
  ('total_watch_time', 'Марафонец III', 'Просмотр 50 часов трансляций', 3000)
on conflict do nothing;
