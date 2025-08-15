insert into achievements (stat_key, title, description, threshold) values
  ('first_message', 'First Blood', 'Отправлено первое сообщение в чате', 1),
  ('clips_created', 'Клипмейкер', 'Создан первый клип', 1),
  ('combo_commands', 'Комбо-режим', 'Выполнить !интим и !поцелуй в течение 60 секунд', 1)
on conflict do nothing;
