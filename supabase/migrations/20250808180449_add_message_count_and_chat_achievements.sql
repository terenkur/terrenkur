alter table stream_chatters
  add column if not exists message_count integer default 0;

insert into achievements (stat_key, title, description, threshold) values
  ('message_count', 'Болтун I', 'Отправлено 20 сообщений за стрим', 20),
  ('message_count', 'Болтун II', 'Отправлено 50 сообщений за стрим', 50),
  ('message_count', 'Болтун III', 'Отправлено 100 сообщений за стрим', 100),
  ('total_chat_messages_sent', 'Завсегдатая I', 'Отправлено 500 сообщений в чате', 500),
  ('total_chat_messages_sent', 'Завсегдатая II', 'Отправлено 1000 сообщений в чате', 1000),
  ('total_chat_messages_sent', 'Завсегдатая III', 'Отправлено 2000 сообщений в чате', 2000)
on conflict do nothing;
